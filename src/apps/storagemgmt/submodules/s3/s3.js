define(function(require){
	var $ = require('jquery');

	const CONFIG = {
		submoduleName: 's3',
		i18n: [ 'en-US' ]
	};

	var app = {
		requests: {},

		subscribe: {
			'storagemgmt.fetchStorages': 'defineStorageS3'
		},

		defineStorageS3: function(args) {
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
					's3': methods
				}
			);

			args.callback && args.callback(CONFIG)
		}
	};

	return app;
});
