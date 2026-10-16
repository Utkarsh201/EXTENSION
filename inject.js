if (!window.hasHookedXMLHttpRequest) {
    window.hasHookedXMLHttpRequest = true;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._url = url; 
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        this.addEventListener("load", function () {
            if (this._url && this._url.includes(`problems/user`)) {
                const data = {
                    url: this._url,
                    status: this.status,
                    response: this.responseText,
                };
                window.dispatchEvent(new CustomEvent("xhrDataFetched", { detail: data }));
            }
        });
        return originalSend.apply(this, arguments);
    };

    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const response = await originalFetch.apply(this, args);
            try {
                const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                if (url && url.includes('problems/user')) {
                    const clone = response.clone();
                    clone.text().then(text => {
                        window.dispatchEvent(new CustomEvent("xhrDataFetched", {
                            detail: { url, status: response.status, response: text }
                        }));
                    }).catch(() => {});
                }
            } catch (e) {}
            return response;
        };
    }
}

