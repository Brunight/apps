import { SectionProps } from "deco/types.ts";
import {
  Person,
  ProductDetailsPage,
  ProductListingPage,
} from "../../../commerce/types.ts";
import { scriptAsDataURI } from "../../../utils/dataURI.ts";
import { AppContext } from "../../mod.ts";
import getSource from "../../utils/source.ts";
import type { LinxUser } from "../../utils/types/analytics.ts";

type Page =
  | "home"
  | "category"
  | "product"
  | "search"
  | "checkout"
  | "landingpage"
  | "notfound"
  | "hotsite"
  | "userprofile"
  | "other";

interface Category {
  /**
   * @hide
   * @default category
   */
  page: string;
  products: ProductListingPage | null;
}

interface Product {
  /**
   * @hide
   * @default product
   */
  page: string;
  details: ProductDetailsPage | null;
}

interface Home {
  /**
   * @hide
   * @default home
   */
  page: string;
}

interface Other {
  /**
   * @hide
   * @default other
   */
  page: string;
}

interface Search {
  /**
   * @hide
   * @default search
   */
  page: string;
  result: ProductListingPage | null;
}

interface Checkout {
  /**
   * @hide
   * @default checkout
   */
  page: string;
}

interface LandingPage {
  /**
   * @hide
   * @default landingpage
   */
  page: string;
}

interface NotFound {
  /**
   * @hide
   * @default notfound
   */
  page: string;
}

interface Hotsite {
  /**
   * @hide
   * @default hotsite
   */
  page: string;
}

interface UserProfile {
  /**
   * @hide
   * @default userprofile
   */
  page: string;
}

interface SendViewEventParams {
  page: Page | string;
  body?: Record<string, any>;
}

interface Props {
  /**
   * @title Event
   * @description "cart" and "transaction" events are not supported by this section. To track these events, implement them manually in your code.
   */
  event:
    | Home
    | Category
    | Product
    | Search
    | Other
    | Checkout
    | LandingPage
    | NotFound
    | Hotsite
    | UserProfile;
  user: Person | null;
}

/** @title Linx Impulse Integration - Events */
export const script = async (props: SectionProps<typeof loader>) => {
  const { event, source, apiKey, salesChannel, url: urlStr } = props;
  if (!event) return;

  const { page } = event;

  const user: LinxUser | undefined = props.user
    ? {
      id: props.user["@id"] ?? props.user.email ?? "",
      email: props.user.email ?? "",
      gender: props.user.gender === "https://schema.org/Female" ? "F" : "M",
      name: props.user.name,
      // TODO: get these from user
      allowMailMarketing: false,
      birthday: undefined,
    }
    : undefined;

  const commonBody = {
    apiKey,
    source,
    user,
    salesChannel,
  };

  const sendViewEvent = (params: SendViewEventParams) => {
    const baseUrl = new URL(
      `https://api.event.linximpulse.net/v7/events/views/${params.page}`,
    );

    return fetch(baseUrl.toString(), {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...params.body, ...commonBody }),
    });
  };

  const url = new URL(urlStr);

  switch (page) {
    case "category": {
      let searchId: string | undefined;

      if ("products" in event && event.products) {
        for (const product of event.products.products ?? []) {
          searchId = product.isVariantOf?.additionalProperty?.find((p) =>
            p.name === "searchId"
          )?.value;

          if (searchId) {
            break;
          }
        }
      }

      const categories = url.pathname.slice(1).split("/");

      await sendViewEvent({
        page: categories.length === 1 ? "category" : "subcategory",
        body: {
          categories,
          searchId,
        },
      });

      // await ctx.invoke["linx-impulse"].actions.analytics.`sendEvent`({
      //   event: "view",
      //   params: {
      //     page,
      //     source,
      //     user,
      //   },
      // });
      break;
    }
    case "product": {
      if (!("details" in event) || !event.details) break;
      const { details } = event;

      await sendViewEvent({
        page,
        body: {
          pid: details.product.isVariantOf?.productGroupID ??
            details.product.productID,
          price: details.product.offers?.lowPrice,
          sku: details.product.sku,
        },
      });

      // await ctx.invoke["linx-impulse"].actions.analytics.sendEvent({
      //   event: "view",
      //   params: {
      //     page,
      //     source,
      //     user,
      //     pid: details.product.isVariantOf?.productGroupID ??
      //       details.product.productID,
      //     price: details.product.offers?.lowPrice,
      //     sku: details.product.sku,
      //   },
      // });
      break;
    }
    case "search": {
      if (!("result" in event) || !event.result) break;
      const { result } = event;

      const query = url.searchParams.get("q") ??
        url.pathname.split("/").pop() ?? "";

        if (!result.products?.length) {
          return sendViewEvent({
            page: "emptysearch",
            body: {
              query,
              items: []
            },
          });
        }

      let searchId: string | undefined;
      const items = result.products.map((product) => {
        if (!searchId) {
          searchId = product.isVariantOf?.additionalProperty?.find((p) =>
            p.name === "searchId"
          )?.value;
        }
        return ({
          pid: product.isVariantOf?.productGroupID ?? product.productID,
          sku: product.sku,
        });
      });

      await sendViewEvent({
        page,
        body: {
          query,
          items,
          searchId,
        },
      });

      // await ctx.invoke["linx-impulse"].actions.analytics.sendEvent({
      //   event: "view",
      //   params: {
      //     page,
      //     source,
      //     user,
      //     query,
      //     items,
      //     searchId,
      //   },
      // });
      break;
    }
    default: {
      await sendViewEvent({
        page,
      });
      // await ctx.invoke["linx-impulse"].actions.analytics.sendEvent({
      //   event: "view",
      //   params: {
      //     page,
      //     source,
      //     user,
      //   },
      // });
      break;
    }
  }
};

/** @title Linx Impulse - Page View Events */
export const loader = (props: Props, req: Request, ctx: AppContext) => ({
  ...props,
  apiKey: ctx.apiKey,
  salesChannel: ctx.salesChannel,
  source: getSource(ctx),
  url: req.url,
});

export default function LinxImpulsePageView(
  props: SectionProps<typeof loader>,
) {
  return (
    <div>
      <script defer src={scriptAsDataURI(script, props)} />
      <span class="hidden">
        {"details" in props.event && props.event.details?.product?.productID}
        {"result" in props.event && props.event.result?.products?.length}
        {"products" in props.event && props.event.products?.products?.length}
      </span>
    </div>
  );
}
