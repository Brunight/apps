import { getCookies, setCookie } from "std/http/cookie.ts";
import { AppMiddlewareContext } from "./mod.ts";
import { getDeviceIdFromBag, setDeviceIdInBag } from "./utils/deviceId.ts";
import { DEVICE_ID_COOKIE_NAME } from "./utils/constants.ts";

export const middleware = (
  _props: unknown,
  req: Request,
  ctx: AppMiddlewareContext,
) => {
  const deviceId = getDeviceIdFromBag(ctx);

  if (!deviceId) {
    const cookies = getCookies(req.headers);
    let cookie = cookies[DEVICE_ID_COOKIE_NAME];

    if (!cookie) {
      cookie = crypto.randomUUID();

      setCookie(ctx.response.headers, {
        value: cookie,
        name: DEVICE_ID_COOKIE_NAME,
        path: "/",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        // secure: true,
        // httpOnly: true,
      });

      setCookie(ctx.response.headers, {
        value: cookie,
        name: "nav_id",
        path: "/",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        // secure: true,
        // httpOnly: true,
      });
    }

    setDeviceIdInBag(ctx, cookie);
  }

  return ctx.next!();
};
