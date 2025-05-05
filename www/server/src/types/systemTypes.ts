/* System APIs */
export enum SystemApi {
  ACK = "ack",
  PING = "ping",
  PONG = "pong",
}

export type SystemApiMessage = {
  api: SystemApi;
  id?: string;
};

/* Error API */
export enum ErrorApi {
  ERROR = "error",
}

export type ErrorApiMessage = {
  api: ErrorApi;
  id: string;
  payload: ErrorApiPayload;
};

export type ErrorApiPayload = {
  message: string;
};
