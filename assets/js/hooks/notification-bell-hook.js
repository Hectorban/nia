/**
A hook to listen for notification events from the UserNotificationsChannel, and forward the
updates directly to the NotificationBellComponent.

Doing this allows us to avoid something like `use PetalProWeb.UserNotificationHandlers` being
injected into every live view.
*/
import { Socket } from "phoenix";

const NotificationBellHook = {
  mounted() {
    const hook = this;
    const bellSelector = `#${hook.el.id}`;

    hook.channel = null;
    hook.channelId = null;
    hook.userSocket = null;

    if (window.userToken == null || window.userToken === "") {
      console.error("Unable to connect to user socket: token not found");
    } else {
      let params = { token: window.userToken };
      hook.userSocket = new Socket("/socket", { params });
      hook.userSocket.connect();

      hook.handleEvent("app:join_notifications_channel", ({ id }) => {
        hook.channelId = `user_notifications:${id}`;
        hook.channel = hook.userSocket.channel(hook.channelId, {});

        // when the channel tells us notifications were updated,
        // push the corresponding event to the live component
        hook.channel.on("notifications_updated", () => {
          hook.pushEventTo(bellSelector, "hook:refresh_notifications", {});
        });

        hook.channel
          .join()
          .receive("ok", () => {})
          .receive("error", (resp) => {
            console.error("Unable to join notifications channel", resp);
          });
      });
    }
  },
  destroyed() {
    const hook = this;
    if (hook.channel) {
      hook.channel.leave();
    }
  },
};

export default NotificationBellHook;
