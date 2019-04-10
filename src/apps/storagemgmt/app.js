define(function(require) {
	var $ = require('jquery'),
		monster = require('monster'),
		toastr = require('toastr');

	var settings = {
		debug: true
	};

	var log = function(msg){
		if(settings.debug) {
			console.log(msg);
		}
	};

	var storageManager = {
		name: 'storagemgmt',
		css: [ 'app' ],
		requests: {},

		subscribe: {
			'storagemgmt.render': 'storageManagerRender',
			'storagemgmt.getStorageData': 'getStorage'
		},

		i18n: {
			'en-US': { customCss: false }
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

			$(document.body).addClass('storage-conf-app'); // for styles;
		},


		storageManagerRender: function(pArgs) {
			var self = this,
				args = pArgs || {},
				$container = args.container || $('.js-storages-settings .js-settings-content'),
				callback = args.callback;

			if(pArgs.hasOwnProperty('onSetDefault') && typeof(pArgs.onSetDefault) === 'function') {
				self.storageManagerOnSetDefault = pArgs.onSetDefault;
			}

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.getStorage(args, function(data) {
				var storagesList = self.storageManagerFormatData(data.storage);
				log('Storages List:');
				log(storagesList);
				var template = $(self.getTemplate({
					name: 'layout',
					submodule: 'storageManager',
					data: {
						storages: storagesList
					}
				}));

				self.storageManagerBind(template, args, storagesList);

				$container.empty()
					.append(template).closest('.js-storages-settings').slideDown();

				if(typeof(callback) === 'function') {
					callback(data);
				}
			});
		},

		_doStorageInitialRequest: function(callback) {
			var self = this;

			self.callApi({
				resource : 'storage.add',
				data : {
					accountId : self.accountId,
					data : {},
					removeMetadataAPI: true,
					generateError: self.settings.debug
				},
				success : function(data) {
					if(typeof(callback) === 'function') {
						callback(data);
					}
				},
				error : function(textStatus) {
					self.log('Error');
					self.log(textStatus);
					if(typeof(callback) === 'function') {
						callback(null);
					}
				}
			});
		},

		/* getStorageData: function(args, callback) {
			var self = this;

			monster.parallel({
				storage: function(callback) {
					if (args.hasOwnProperty('data')) {
						callback && callback(null, args.data);
					} else {
						self.getStorage(function(data) {
							callback && callback(null, data);
						});
					}
				}
			}, function(err, results) {
				callback && callback(results);
			});
		}, */

		getStorage: function(callback) {
			var self = this;

			return new Promise((resolve, reject) => {

			})

			return self.callApi({
				resource: 'storage.get',
				data: {
					accountId: self.accountId,
					removeMetadataAPI: true,
					generateError: false
				},
				success: function(data) {
					log('Storage Data:');
					log(data);

					try {
						var storageUUID = data.data.plan.modb.types.call_recording.attachments.handler;
						var storageData = data.data.attachments[storageUUID];

						self._getRecordings(function(recordings) {
							self._renderRecordingsTable(recordings);
						});
					} catch(e) {
						// Open settings to create new storage
						$('#settings-btn').click();
					}



					callback(data.data);
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

		storageManagerFormatData: function(data) {
			var activeStorageId = null;
			try {
				activeStorageId = data.plan.modb.types.call_recording.attachments.handler;
			} catch(e) {
				log('Active storage not found');
			}
			var itemData;
			var storagesList = [];
			if(data.hasOwnProperty('attachments') && Object.keys(data.attachments).length > 0) {
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

					var $container = $editStorageBtn.closest('.js-storage-item')
						.find('.js-item-settings-wrapper')
						.hide();

					var uuid = $editStorageBtn.closest('.js-storage-item').data('uuid');

					if(data.attachments.hasOwnProperty(uuid)) {
						var storageData = data.attachments[uuid];
					}

					var template = $(self.getTemplate({
						name: 'item-settings',
						submodule: 'storageManager',
						data: {
							name: storageData.name,
							bucket: storageData.settings.bucket,
							key: storageData.settings.key,
							secret: storageData.settings.secret
						}
					}));

					$container.empty()
						.append(template);
					$container.slideDown();

					self.storageManagerSettingsBind($container);
				})
			});

			template.on('click', '.js-remove-storage', function(e) {
				e.preventDefault();
				var uuid = $(this).closest('.js-storage-item').data('uuid');
				monster.ui.confirm(self.i18n.active().recordings.storageManager.confirmDeleteText, function() {
					self.storageManagerDeleteStorage(uuid, function() {
						$('.js-storage-item[data-uuid="' + uuid + '"]').slideUp(400, function() {
							$(this).remove();
						});
						self.storageManagerShowMessage(self.i18n.active().recordings.storageManager.successRemovingMessage);
					});
				}, undefined, {
					type: 'warning',
					title: self.i18n.active().recordings.storageManager.confirmDeleteTitle,
					confirmButtonText: self.i18n.active().recordings.storageManager.confirmDelete
				});
			});

			template.on('click', '.js-create-storage', function(e) {
				e.preventDefault();
				self.storageManagerShowNewItemPanel();
			});

			template.on('click', '.js-set-default-storage', function(e) {
				e.preventDefault();
				var uuid = $(this).closest('.js-storage-item').data('uuid');
				var isAlreadyActive = $(this).closest('.js-storage-item').hasClass('active-storage');

				if(isAlreadyActive) {
					self.storageManagerShowMessage(self.i18n.active().recordings.storageManager.alreadyActiveMessage, 'warning')
				} else {
					self.storageManagerSetDefaultStorage(uuid);
				}
			});
		},

		storageManagerShowNewItemPanel: function(){
			var self = this;

			var template = $(self.getTemplate({
				name: 'new-item',
				submodule: 'storageManager'
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

				var storageData = {};
				if($tab.data('type') === 'aws') {
					storageData.name = $tab.find('input[name="name"]').val();
					storageData.bucket = $tab.find('input[name="bucket"]').val();
					storageData.key = $tab.find('input[name="key"]').val();
					storageData.secret = $tab.find('input[name="secret"]').val();
					storageData.type = 's3';
				}
				storageData.uuid = self.storageManagerGenerateUUID();

				var isNeedSetDefault = $tab.find('input[name="set_default"]').is(':checked');

				self.storageManagerSaveStorage(storageData, function(){
					if(isNeedSetDefault) {
						self.storageManagerSetDefaultStorage(storageData.uuid);
					}

					self.storageManagerReload(function(){
						self.storageManagerShowMessage(self.i18n.active().recordings.storageManager.successSavingMessage, 'success');
					});
				});
			});

			template.on('click', '.js-cancel', function (e) {
				e.preventDefault();
				$('.js-new-storage-item').slideUp(400, function(){
					$('.js-new-storage-item').remove();
				});
			});
		},

		storageManagerReload: function(callback) {
			this.storageManagerRender({
				callback: callback
			});
		},

		storageManagerSetDefaultStorage: function(uuid) {
			var self = this;

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.getStorage(function(data) {
				if(!data || typeof(data) === 'undefined') {
					data = {};
				}

				var resultData = {};
				if(data.hasOwnProperty('attachments')) {
					resultData.attachments = data.attachments;
				}
				if(data.hasOwnProperty('plan')) {
					resultData.plan = data.plan;
				}

				var newData = {
					plan: {
						modb: {
							types: {
								call_recording: {
									attachments: {
										handler: uuid
									}
								}
							}
						}
					}
				};

				// Merge newData into data
				$.extend(resultData, newData);

				self.storageManagerUpdateStorage(resultData, function(data) {
					$('#storage_manager_wrapper').find('.js-storage-item')
						.removeClass('active-storage');

					$('.js-storage-item[data-uuid="' + uuid + '"]').addClass('active-storage');

					self.storageManagerOnSetDefault(data);
				});
			})
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

				var storageData = {
					type: $storageItem.data('storage-type'),
					uuid: $storageItem.data('uuid')
				};

				var $form = $storageItem.find('.js-storage-settings-form');

				if(storageData.type === 's3') {
					storageData.name = $form.find('input[name="name"]').val();
					storageData.bucket = $form.find('input[name="bucket"]').val();
					storageData.key = $form.find('input[name="key"]').val();
					storageData.secret = $form.find('input[name="secret"]').val();
				}

				self.storageManagerSaveStorage(storageData, function(data) {
					// update item name
					$('.js-storage-item[data-uuid="' + storageData.uuid + '"]').find('.js-storage-name').text(storageData.name);

					self.storageManagerShowMessage(self.i18n.active().recordings.storageManager.successUpdate, 'success');
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
						resultData.plan.modb.types.call_recording.attachments.handler = '';
					}
				} catch (e) {}

				self.storageManagerUpdateStorage(resultData, function() {
					if(typeof(callback) === 'function') {
						callback();
					}
				});
			})
		},
		storageManagerSaveStorage: function(saveData, callback) {
			var self = this;

			if(!monster.util.isAdmin()) {
				log('Permission error. Use admin account for change storage settings');
				return;
			}

			self.getStorage(function(storagesData) {
				if(!storagesData || typeof(storagesData) === 'undefined') {
					storagesData = {};
				}

				var resultData = {};
				if(storagesData.hasOwnProperty('attachments')) {
					resultData.attachments = storagesData.attachments;
				}
				if(storagesData.hasOwnProperty('plan')) {
					resultData.plan = storagesData.plan;
				}

				if(saveData.type === 's3') {
					var newData = {
						'attachments': {}
					};
					newData.attachments[saveData.uuid] = {
						'handler': 's3',
						'name': saveData.name,
						'settings': {
							'bucket': saveData.bucket,
							'key': saveData.key,
							'secret': saveData.secret
						}
					}
				}

				$.extend(true, resultData, newData);

				self.storageManagerUpdateStorage(resultData, callback);
			})
		},

		storageManagerGenerateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
