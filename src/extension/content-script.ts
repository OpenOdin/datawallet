declare const browser: any;
declare const chrome: any;

const browserHandle = typeof(browser) !== "undefined" ? browser : chrome;

type OnMessageAddListener = (param: any) => void;
type OnDisconnectAddListener = (param: any) => void;

type Port = {
    postMessage: (message: any) => void,
    onMessage: {addListener: OnMessageAddListener},
    onDisconnect: {addListener: OnDisconnectAddListener},
    disconnect: () => void,
};

const bgPorts: {[rpcId: string]: Port | false} = {};

function getBgPort(rpcId: string): Port | undefined {
    const rpcBaseId = rpcId.split("_")[0];

    let bgPort = bgPorts[rpcBaseId];

    if (bgPort === false) {
        // Port has been closed, do not attempt to open it again.
        //
        return undefined;
    }
    else if (bgPort === undefined) {
        // Open port to background-script.
        // If extensions is not available then we expect the onDisconnect event to be fired.
        //
        bgPort = browserHandle.runtime.connect({name: `openodin-content-to-background_${rpcBaseId}`}) as Port;

        bgPorts[rpcBaseId] = bgPort;

        // Listen on message from bg and pass it on to the page.
        //
        bgPort.onMessage.addListener(postMessageToPage);

        bgPort.onDisconnect.addListener( () => {
            // Event triggered when extension gets unloaded or on a failed connect attempt occurs
            // because extension was unloaded.
            //

            bgPorts[rpcBaseId] = false;

            window.postMessage({message: {rpcId}, direction: "openodin-content-script-port-closed"}, "*");
        });
    }

    return bgPort;
}

function postMessageToPage(message: any) {
    window.postMessage({message, direction: "openodin-content-script-message"}, "*");
}

(function() {
    //@ts-ignore
    if (!window.hasRun) {
        //@ts-ignore
        window.hasRun = true;

        // Listen on message from page.
        //
        window.addEventListener("message", (event) => {
            if (event.source !== window) {
                return;
            }

            // Message from page-script on RPC.
            //
            if (event?.data?.direction === "openodin-page-script-message") {
                const message = event.data.message;

                const rpcId = message.rpcId;

                // Get port to background-script.
                //
                const bgPort = getBgPort(rpcId);

                // Post message to background-script using port.
                // Note: the port might not be functional in which case postMessage will throw an
                // error(?) and the disconnect event will have been triggered.
                //
                bgPort && bgPort.postMessage(message);
            }
            else if (event?.data?.direction === "openodin-page-script-close-port") {
                const message = event.data.message;

                const rpcId = message.rpcId;

                const rpcBaseId = rpcId.split("_")[0];

                const bgPort = bgPorts[rpcBaseId];

                if (bgPort) {
                    delete bgPorts[rpcBaseId];

                    // This will not trigger onDisconnect on this side, only in the background-script.
                    //
                    bgPort.disconnect();

                    // Manually trigger the onDisconnect event in OpenOdin.
                    //
                    window.postMessage({message: {rpcId},
                        direction: "openodin-content-script-port-closed"}, "*");
                }
            }
        });
    }

    window.postMessage({message: {}, direction: "openodin-content-script-open"}, "*");
})();
