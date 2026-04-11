declare module "web-push" {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  interface WebPush {
    setVapidDetails(
      subject: string,
      publicKey: string,
      privateKey: string,
    ): void;
    sendNotification(
      subscription: PushSubscription,
      payload: string | Buffer,
    ): Promise<unknown>;
  }

  const webPush: WebPush;
  export default webPush;
}
