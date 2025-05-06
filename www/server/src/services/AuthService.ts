import { WebSocket } from "ws";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { DeliveryService } from "./DeliveryService.js";
import { createUser, findUserById, findUserByName } from "../mongodb/mongoApi.js";
import { OnlineUsersService } from "./OnlineUsersService.js";
import { loginPayload, RequestApi, signupPayload } from "../types/requestTypes.js";
import { generateJwtToken, verifyJwtToken } from "../utils/jwtUtils.js";

export class AuthService {
  private static _instance: AuthService;

  private constructor(
    private deliveryService: DeliveryService,
    private onlineUsers: OnlineUsersService
  ) {}

  public static init(deliveryService: DeliveryService, onlineUsers: OnlineUsersService) {
    if (!this._instance) this._instance = new AuthService(deliveryService, onlineUsers);
    return this._instance;
  }
  public static get instance(): AuthService {
    if (!this._instance)
      throw new Error("AuthService not initialised - call AuthService.init() first");
    return this._instance;
  }

  /**
   * Handles the authentication of a user.
   * @param ws - The WebSocket connection.
   * @param token - The JWT token.
   * @param id - The _id of the message.
   */
  public async handleAuth(ws: WebSocket, token: string, id: string) {
    try {
      if (!token) throw new Error("No token provided");

      const { userId } = verifyJwtToken(token);
      const user = await findUserById(new ObjectId(userId));
      if (!user) throw new Error("JWT expired");
      ws.isAuthenticated = true;
      ws.userId = userId;
      this.onlineUsers.addUser(ws);
      this.deliveryService.sendMessage(userId, {
        id,
        api: RequestApi.SEND_AUTH,
        payload: {},
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
      this.deliveryService.sendError(ws, id, { message: errMsg });
    }
    return;
  }

  /**
   * Handles the login of a user.
   * @param ws - The WebSocket connection.
   * @param payload - The login payload.
   * @param id - The _id of the message.
   */
  public async handleLogin(ws: WebSocket, payload: loginPayload, id: string) {
    try {
      const { username, password } = payload;
      const user = await findUserByName(username);

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return this.deliveryService.sendError(ws, id, { message: "Invalid password" });
      }
      const token = generateJwtToken(user._id.toString());
      ws.isAuthenticated = true;
      ws.userId = user._id.toString();
      this.onlineUsers.addUser(ws);
      this.deliveryService.sendMessage(ws.userId ?? "", {
        id,
        api: RequestApi.LOGIN,
        payload: { userId: user._id.toString(), token },
      });
      return;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
      this.deliveryService.sendError(ws, id, { message: errMsg });
    }
    return;
  }

  /**
   * Handles the signup of a user.
   * @param ws - The WebSocket connection.
   * @param payload - The signup payload.
   * @param id - The _id of the message.
   */
  public async handleSignup(ws: WebSocket, payload: signupPayload, id: string) {
    const { username, password } = payload;
    try {
      const userId = await createUser(username, password);
      const token = generateJwtToken(userId.toString());
      ws.isAuthenticated = true;
      ws.userId = userId.toString();
      this.onlineUsers.addUser(ws);
      this.deliveryService.sendMessage(ws.userId ?? "", {
        id,
        api: RequestApi.SIGNUP,
        payload: { userId: userId.toString(), token },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
      this.deliveryService.sendError(ws, id, { message: errMsg });
    }
    return;
  }
}
