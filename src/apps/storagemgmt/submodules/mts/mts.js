define(function(require){
	var $ = require('jquery');

	const CONFIG = {
		submoduleName: 'mts',
		i18n: [ 'en-US', 'ru-RU' ]
	};

	var app = {
		requests: {},

		subscribe: {
			'storagemgmt.fetchStorages': 'defineStorageMTS'
		},

		defineStorageMTS: function(args) {
			var self = this,
				storage_nodes = args.storages;

			var methods = {
				getLogo: function () {
					return self.getTemplate({
						name: 'logo',
						submodule: CONFIG.submoduleName,
						data: {}
					});
				},

				getFormElements: function (storageData) {
					return self.getTemplate({
						name: 'formElements',
						submodule: CONFIG.submoduleName,
						data: storageData
					});
				}
			};

			$.extend(true, storage_nodes, {
					'mts': methods
				}
			);

			args.callback && args.callback(CONFIG)
		}
	};

	return app;
});
