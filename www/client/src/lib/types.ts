export interface Link {
    path: string;
    title: string;
}

export interface User {
    uid: string,
    name: string
}

export interface Message {
    from: string; //User
    text: string;
    sendTime: string; //ISO-date
    
}

export interface Chat {
    _id: string; //ID type?
    users: User[];
    messages: Message[];
    lastModified: string; //ISO-Date
}
