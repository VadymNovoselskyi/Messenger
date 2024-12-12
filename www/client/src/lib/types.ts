export interface Link {
    path: string;
    title: string;
}

export interface Message {
    text: string;
    isSent: boolean;
}

export interface Chat {
    _id: string; //ID type?
    users: string[]; //User[]
    messages: Message[];
    lastUpdate: string; //ISO-Date
}
