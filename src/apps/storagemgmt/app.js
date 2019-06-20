define(function(require) {
	var $ = require('jquery'),
		monster = require('monster'),
		toastr = require('toastr'),
		storagesConfig = require('./storages');

	var settings = {
		debug: false
	};

	var log = function(msg){
		if(settings.debug) {
			console.log(msg);
		}
	};

	// Autoload submodules
	// (Submodules should be described in /apps/storagemgmt/storages.js)
	var storagesList = storagesConfig.storages;
	var storagesPaths = [];
	for (var i = 0, len = storagesList.length; i < len; i++) {
		storagesPaths.push('./submodules/' + storagesList[i] + '/' + storagesList[i])
	}
	require(storagesPaths);

	var storageManager = {
		name: 'storagemgmt',
		css: [ 'app' ],
		requests: {},

		subscribe: {
			'storagemgmt.fetchStorages': 'define_storage_nodes' // For all submodules
		},

		subModules: storagesList,

		storages: {},

		i18n: {
			'en-US': { customCss: false },
			'ru-RU': { customCss: false }
		},

		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container) {
			var self = this;

			monster.pub('storagemgmt.fetchStorages', {
				storages: self.storages,
				callback: function (args) {
					self.extendI18nOfSubmodule(args);
				}
			});

			monster.ui.generateAppLayout(self, {
				menus: [
					{
						tabs: [
							{
								callback: self.storageManagerRender
							}
						]
					}
				]
			});

			$(document.body).addClass('storagemgmt-app'); // class for styles;
		},

		extendI18nOfSubmodule: function (args) {
			var self = this;

			var getI18nAndExtend = function (submoduleDirName, langCode) {
				return $.getJSON('/apps/storagemgmt/submodules/' + submoduleDirName + '/i18n/' + langCode  + '.json').done(function (newDict) {
					var curLanguage = self.i18n.hasOwnProperty(monster.config.whitelabel.language) ? monster.config.whitelabel.language : monster.defaultLanguage;
					var dict = self.data.i18n[langCode];
					$.extend(true, dict, newDict);

					if(langCode !== curLanguage) {
						dict = self.data.i18n[curLanguage];
						$.extend(true, dict, newDict);
					}
				})
			};

			if(args.i18n && args.submoduleName) {
				var submoduleLanguages = args.i18n;
				var curLanguage = self.i18n.hasOwnProperty(monster.config.whitelabel.language) ? monster.config.whitelabel.language : monster.defaultLanguage;

				if (submoduleLanguages.length && submoduleLanguages.length > 0) {
					if(submoduleLanguages.indexOf(curLanguage) > -1) {
						// get current language i18n and extend
						getI18nAndExtend(args.submoduleName, curLanguage)
							.fail(function() {
								getI18nAndExtend(args.submoduleName, 'en-US');
							});
					} else {
						getI18nAndExtend(args.submoduleName, 'en-US');
					}
				}
			} else {
				log('Extend i18n of submodule failed');
			}
		},

		storageManagerGetStorageKeyword: function (storageData) {
			// This function is dirty hack, TODO: fix that (add storage keyword to storage api)
			if (storageData.type === 's3') {
				if(storageData.settings.host === 's3.cloud.mts.ru') {
					return 'mts';
				}
				return 's3'
			}
		},

		storageManagerRender: function(pArgs) {
			var self = this,
				args = pArgs || {},
				$container = args.container || $('.app-content-wrapper'),
				callback = args.callback;

			if(pArgs.hasOwnProperty('onSetDefault') && typeof(pArgs.onSetDefault) === 'function') {
				self.storageManagerOnSetDefault = pArgs.onSetDefault;
			}

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.getStorage(function(data) {
				var storagesData = self.storageManagerFormatData(data);
				var storageKeyword;
				for (var i = 0, len = storagesData.length; i < len; i++) {
					storageKeyword = self.storageManagerGetStorageKeyword(storagesData[i])
					storagesData[i].logo = self.storages[storageKeyword].getLogo()
				}

				log('Storages List:');
				log(storagesData);

				var template = $(self.getTemplate({
					name: 'layout',
					data: {
						storages: storagesData
					}
				}));

				self.storageManagerBind(template, args, storagesData);

				$container.empty()
					.append(template);

				if(typeof(callback) === 'function') {
					callback(data);
				}
			});
		},

		_doStorageInitialRequest: function(callback) {
			var self = this;

			self.callApi({
				resource: 'storage.add',
				data: {
					accountId : self.accountId,
					data : {
						'attachments': {},
						'plan': {}
					},
					removeMetadataAPI: true,
					generateError: settings.debug
				},
				success: function(data) {
					if(typeof(callback) === 'function') {
						callback(data);
					}
				},
				error: function(error) {
					var errorMessage = self.i18n.active().storagemgmt.universalErrorMessageTemplate.replace('%api%', 'Storage');
					monster.ui.alert(errorMessage);
					log(error.status + ' - ' + error.error + ': ' + error.message + ' ');
				}
			});
		},

		getStorage: function(callback) {
			var self = this;

			self.callApi({
				resource: 'storage.get',
				data: {
					accountId: self.accountId,
					removeMetadataAPI: true,
					generateError: false
				},
				success: function(data) {
					log('Storage Data:');
					log(data.data);
					callback(data.data);
				},
				error: function(data, error, globalHandler) {
					self._doStorageInitialRequest(function() {
						self.getStorage(callback);
					});
				}
			});
		},

		storageManagerUpdateStorage: function(storageData, callback) {
			var self = this;

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.callApi({
				resource: 'storage.update',
				data: {
					accountId: self.accountId,
					removeMetadataAPI: true, // or generateError: false
					data: storageData
				},
				success: function(data, status) {
					if(typeof(callback) === 'function') {
						callback(data);
					}
				},
				error: function(data, error, globalHandler) {
					if (error.status === 404) {
						callback(undefined);
					} else {
						globalHandler(data);
					}
				}
			});
		},

		storageManagerPatchStorage: function(storageData, callback) {
			var self = this;

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.callApi({
				resource: 'storage.patch',
				data: {
					accountId: self.accountId,
					removeMetadataAPI: true, // or generateError: false
					data: storageData
				},
				success: function(data, status) {
					if(typeof(callback) === 'function') {
						callback(data);
					}
				},
				error: function(data, error, globalHandler) {
					if (error.status === 404) {
						callback(undefined);
					} else {
						globalHandler(data);
					}
				}
			});
		},

		storageManagerFormatData: function(data) {
			var activeStorageId = null;
			try {
				activeStorageId = data.plan.modb.types.call_recording.attachments.handler;
			} catch(e) {
				log('Active storage not found');
			}
			var itemData;
			var storagesList = [];
			if(data && data.hasOwnProperty('attachments') && Object.keys(data.attachments).length > 0) {
				var attachments = data.attachments;
				for(var i in attachments) if(attachments.hasOwnProperty(i)) {
					itemData = {
						id: i,
						type: attachments[i].handler,
						name: attachments[i].name,
						settings: attachments[i].settings,
						isActive: false
					};

					if(activeStorageId && itemData.id === activeStorageId) {
						itemData.isActive = true;
					}
					storagesList.push(itemData)
				}
			}

			return storagesList;
		},

		storageManagerBind: function(template, args, data) {
			var self = this;

			template.on('click', '.js-edit-storage', function(e) {
				e.preventDefault();

				var $editStorageBtn = $(this);
				self.getStorage(function(data) {
					var $storageItem = $editStorageBtn.closest('.js-storage-item');
					var storageType = $storageItem.data('type');
					var uuid = $storageItem.data('uuid');
					var $container = $storageItem
						.find('.js-item-settings-wrapper')
						.hide();

					if(data.attachments.hasOwnProperty(uuid)) {
						var storageData = data.attachments[uuid];
					}

					// TODO: fix this (add storage keyword to storage api)
					var storageKeyword;
					if(storageData.handler === 's3') {
						storageKeyword = 's3';
						if(storageData.settings.host === 's3.cloud.mts.ru') {
							storageKeyword = 'mts';
						}
					}

					var template = self.getTemplate({
						name: 'item-settings',
						data: {
							formElements: self.storages[storageKeyword].getFormElements(storageData)
						}
					});

					$container.empty()
						.append(template);
					$container.slideDown();

					self.storageManagerSettingsBind($container);
				})
			});

			template.on('click', '.js-remove-storage', function(e) {
				e.preventDefault();
				var uuid = $(this).closest('.js-storage-item').data('uuid');
				monster.ui.confirm(self.i18n.active().storagemgmt.confirmDeleteText, function() {
					self.storageManagerDeleteStorage(uuid, function() {
						$('.js-storage-item[data-uuid="' + uuid + '"]').slideUp(400, function() {
							$(this).remove();
						});
						self.storageManagerShowMessage(self.i18n.active().storagemgmt.successRemovingMessage);
					});
				}, undefined, {
					type: 'warning',
					title: self.i18n.active().storagemgmt.confirmDeleteTitle,
					confirmButtonText: self.i18n.active().storagemgmt.confirmDelete
				});
			});

			template.on('click', '.js-create-storage', function(e) {
				e.preventDefault();
				var $newStorageItem = $('.js-storage-items .js-new-storage-item');
				if ($newStorageItem.length === 0) {
					self.storageManagerShowNewItemPanel();
				} else {
					$newStorageItem.addClass('flash-effect');
					(function($newStorageItem){
						var timeoutId = setTimeout(function() {
							$newStorageItem.removeClass('flash-effect');
						}, 2000)
					})($newStorageItem)
				}
			});

			template.on('click', '.js-set-default-storage', function(e) {
				e.preventDefault();
				var uuid = $(this).closest('.js-storage-item').data('uuid');
				var isAlreadyActive = $(this).closest('.js-storage-item').hasClass('active-storage');

				if(isAlreadyActive) {
					self.storageManagerShowMessage(self.i18n.active().storagemgmt.alreadyActiveMessage, 'warning')
				} else {
					self.storageManagerSetDefaultStorage(uuid);
				}
			});
		},

		storageManagerShowNewItemPanel: function(){
			var self = this;

			var data = [];

			var keyword = '';
			var storagesList = Object.keys(self.storages);
			for (var i = 0, len = storagesList.length; i < len; i++) {
				keyword = storagesList[i];
				data.push({
					name: keyword,
					type: keyword,
					logo: self.storages[keyword].getLogo(),
					tabId: keyword + '-new-item-content',
					tabLink: '#' + keyword + '-new-item-content',
					formElements: self.storages[keyword].getFormElements({})
				})
			}

			var template = $(self.getTemplate({
				name: 'new-item',
				data: {
					storages: data
				}
			}));

			self.storageManagerNewItemBind(template);

			$('.js-storage-items').append(template);
			$('.js-new-storage-item').hide().slideDown(400, function(){});
			$('.js-new-storage-tabs').tabs();
		},

		storageManagerNewItemBind: function(template) {
			var self = this;

			template.on('click', '.js-save', function (e) {
				e.preventDefault();

				var $tab = $(this).closest('.js-tab-content-item');
				var $form = $tab.find('.js-storage-settings-form');
				var formData = monster.ui.getFormData($form[0]);
				var isNeedSetDefault = $tab.find('input[name="set_default"]').is(':checked');
				var typeKeyword = $tab.data('type');
				var newUuid = self.storageManagerGenerateUUID();
				delete formData['set_default'];
				var storageData = self.storageManagerMakeConfig(typeKeyword, formData, newUuid);

				self.storageManagerPatchStorage(storageData, function(){
					var renderArgs = {
						callback: function () {
							self.storageManagerShowMessage(self.i18n.active().storagemgmt.successSavingMessage, 'success');
						}
					};

					if(isNeedSetDefault) {
						self.storageManagerSetDefaultStorage(newUuid, function () {
							self.storageManagerRender(renderArgs);
						});
					} else {
						self.storageManagerRender(renderArgs);
					}
				});
			});

			template.on('click', '.js-cancel', function (e) {
				e.preventDefault();
				$('.js-new-storage-item').slideUp(400, function(){
					$('.js-new-storage-item').remove();
				});
			});
		},

		storageManagerMakeConfig (storageKeyword, data, uuid) {
			var self = this,
				storageData = {
					'attachments': {}
				};

			if(typeof(uuid) === 'undefined') {
				uuid = self.storageManagerGenerateUUID();
			}

			if(storageKeyword && self.storages.hasOwnProperty(storageKeyword)) {
				storageData.attachments[uuid] = data;
				return storageData;
			} else {
				monster.ui.alert('Please install storage correctly (' + storageKeyword + ')');
			}
		},

		storageManagerSetDefaultStorage: function(uuid, callback) {
			var self = this;

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			var newData = {
				plan: {
					modb: {
						types: {
							call_recording: {
								attachments: {
									handler: uuid
								}
							},
							mailbox_message: {
								attachments: {
									handler: uuid
								}
							}
						}
					},
					account: {
						types: {
							media: {
								attachments: {
									handler: uuid
								}
							}
						}
					},
				}
			};


			self.storageManagerPatchStorage(newData, function(data) {
				$('#storage_manager_wrapper').find('.js-storage-item')
					.removeClass('active-storage');

				$('.js-storage-item[data-uuid="' + uuid + '"]').addClass('active-storage');

				self.storageManagerOnSetDefault(data);
				callback && callback(data);
			});
		},

		storageManagerOnSetDefault: function(data) {},

		storageManagerSettingsBind: function($settingsContainer) {
			var self = this;

			$settingsContainer.find('.js-cancel').on('click', function(e) {
				e.preventDefault();
				$settingsContainer.slideUp(400, function(){
					$settingsContainer.empty();
				});
			});

			$settingsContainer.find('.js-save').on('click', function(e) {
				e.preventDefault();
				var $storageItem = $(this).closest('.js-storage-item');
				var $form = $storageItem.find('.js-storage-settings-form');
				var formData = monster.ui.getFormData($form[0]);
				var storageName = formData.name;
				var typeKeyword = $storageItem.data('type');
				var uuid = $storageItem.data('uuid');
				// TODO: typeKeyword is not correct, fix that
				var storageData = self.storageManagerMakeConfig(typeKeyword, formData, uuid);

				self.getStorage(function(existStorageData) {
					self.storageManagerPatchStorage(storageData, function(data) {
						// update item name
						$('.js-storage-item[data-uuid="' + uuid + '"]').find('.js-storage-name').text(storageName);
						self.storageManagerShowMessage(self.i18n.active().storagemgmt.successUpdate, 'success');
					});
				});

			});
		},

		storageManagerDeleteStorage: function(uuid, callback) {
			var self = this;

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.getStorage(function(storagesData) {
				var resultData = {};
				if(storagesData.hasOwnProperty('attachments')) {
					resultData.attachments = storagesData.attachments;
				}
				if(storagesData.hasOwnProperty('plan')) {
					resultData.plan = storagesData.plan;
				}

				if(resultData.attachments && resultData.attachments.hasOwnProperty(uuid)) {
					delete resultData.attachments[uuid];
				}

				try {
					if(resultData.plan.modb.types.call_recording.attachments.handler === uuid) {
						resultData.plan = {};
					}
				} catch (e) {}

				self.storageManagerUpdateStorage(resultData, function() {
					if(typeof(callback) === 'function') {
						callback();
					}
				});
			})
		},

		storageManagerGenerateUUID: function() {
			return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		storageManagerShowMessage: function(msg, msgType) {
			var msgTypeClass;

			if(typeof(msgType) === 'undefined') {
				msgType = 'info';
			}

			switch(msgType) {
				case 'warning':
					msgTypeClass = 'storage-msg-warning';
					break;
				case 'success':
					msgTypeClass = 'storage-msg-success';
					break;
				default: // 'info'
					msgTypeClass = 'storage-msg-info';
			}

			var $msg = $('<div class="storage-message ' + msgTypeClass + '">' + msg + '</div>')
				.appendTo($('.js-storage-msg-box')).hide().fadeIn();

			$msg.animate({
					backgroundColor: '#ffffff'
				}, 1000
			);

			window.setTimeout(function(){
				$msg.fadeOut(400, function() {
					$msg.remove();
				})
			}, 4000);
		}
	};

	return storageManager;
});
