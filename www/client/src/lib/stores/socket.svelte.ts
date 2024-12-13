const wsDummy: any = null;

export let ws: {socket: WebSocket} = $state({
    socket: wsDummy
});