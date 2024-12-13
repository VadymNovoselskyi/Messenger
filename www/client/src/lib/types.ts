export interface Link {
    path: string;
    title: string;
}

export interface Message {
    mid: number;
    from: string; //User
    text: string;
    sendTime: string; //ISO-date
    
}

export interface Chat {
    _id: string; //ID type?
    users: string[]; //User[]
    messages: Message[];
    lastUpdate: string; //ISO-Date
}
