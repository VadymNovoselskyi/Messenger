export interface Link {
    path: string;
    title: string;
}

export interface Message {
    message: string;
    isSent: boolean;
}

export interface Chat {
    imgSrc: string;
    title: string;
    message: string;
    lastUpdate: string;
}