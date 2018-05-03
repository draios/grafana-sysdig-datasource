import { GenericDatasource } from './datasource';
import { GenericDatasourceQueryCtrl } from './query_ctrl';
import { SysdigConfigCtrl } from './config_ctrl';

class GenericQueryOptionsCtrl {}
GenericQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

class GenericAnnotationsQueryCtrl {}
GenericAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

export {
    GenericDatasource as Datasource,
    GenericDatasourceQueryCtrl as QueryCtrl,
    SysdigConfigCtrl as ConfigCtrl,
    GenericQueryOptionsCtrl as QueryOptionsCtrl,
    GenericAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
