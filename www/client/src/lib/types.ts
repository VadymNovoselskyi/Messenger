export interface Link {
    path: string;
    title: string;
    pathsToCheck?: string[];
}

export interface User {
    uid: string,
    username: string
}

export interface Message {
    mid: string
    from: string; //User
    text: string;
    sendTime: string; //ISO-date
    isReceived?: boolean;
}

export interface Chat {
    _id: string; //ID type?
    users: User[];
    messages: Message[];
    lastModified: string; //ISO-Date
}
