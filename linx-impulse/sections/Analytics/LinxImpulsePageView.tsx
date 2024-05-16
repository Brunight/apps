import { SectionProps } from "deco/types.ts";
import {
  PageInfo,
  Person,
  ProductDetailsPage,
  ProductListingPage,
} from "../../../commerce/types.ts";
import { scriptAsDataURI } from "../../../utils/dataURI.ts";
import { AppContext } from "../../mod.ts";
import getSource from "../../utils/source.ts";
import type { LinxUser } from "../../utils/types/analytics.ts";
import { getDeviceIdFromBag } from "../../utils/deviceId.ts";

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
  const { event, source, apiKey, salesChannel, url: urlStr, deviceId } = props;
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

  const sendViewEvent = (params: SendViewEventParams) => {
    const baseUrl = new URL(
      `https://api.event.linximpulse.net/v7/events/views/${params.page}`,
    );

    // deviceId && baseUrl.searchParams.append("deviceId", deviceId);

    return fetch(baseUrl.toString(), {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        apiKey,
        source,
        user,
        deviceId,
        salesChannel,
        ...params.body,
      }),
    });
  };

  const getSearchIdFromPageInfo = (pageInfo?: PageInfo | null) => {
    const searchIdInPageTypes = pageInfo?.pageTypes?.find((
      pageType,
    ) => pageType?.startsWith("SearchId:"));
    return searchIdInPageTypes?.replace("SearchId:", "");
  };

  const url = new URL(urlStr);

  switch (page) {
    case "subcategory":
    case "category": {
      const searchId = getSearchIdFromPageInfo(
        "products" in event && event.products
          ? event.products.pageInfo
          : undefined,
      );

      const categories = url.pathname.slice(1).split("/");

      await sendViewEvent({
        page: categories.length === 1 ? "category" : "subcategory",
        body: {
          categories,
          searchId,
        },
      });

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

      break;
    }
    case "search": {
      const searchId = getSearchIdFromPageInfo(
        "result" in event && event.result ? event.result.pageInfo : undefined,
      );
      const query = url.searchParams.get("q") ??
        url.pathname.split("/").pop() ?? "";

      if (
        (!("result" in event) || !event.result) || !event.result.products.length
      ) {
        return sendViewEvent({
          page: "emptysearch",
          body: {
            query,
            items: [],
            searchId,
          },
        });
      }

      event.result.pageInfo;

      const { result } = event;

      const items = result.products.map((product) => {
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

      break;
    }
    default: {
      await sendViewEvent({
        page,
      });

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
  deviceId: getDeviceIdFromBag(ctx),
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
