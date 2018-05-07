export default class ApiService {
    static send(backend, options) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Sysdig-Product': 'SDC',
            Authorization: `Bearer ${backend.apiToken}`
        };

        return backend.backendSrv.datasourceRequest(
            Object.assign({}, options, {
                headers,
                url: `${backend.url}/${options.url}`,
                method: options.method || 'GET'
            })
        );
    }
}
