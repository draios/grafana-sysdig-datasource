import { SysdigDatasource } from './datasource';
import { SysdigDatasourceQueryCtrl } from './query_ctrl';
import { SysdigConfigCtrl } from './config_ctrl';

class GenericQueryOptionsCtrl {}
GenericQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

class GenericAnnotationsQueryCtrl {}
GenericAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

export {
    SysdigDatasource as Datasource,
    SysdigDatasourceQueryCtrl as QueryCtrl,
    SysdigConfigCtrl as ConfigCtrl,
    GenericQueryOptionsCtrl as QueryOptionsCtrl,
    GenericAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
