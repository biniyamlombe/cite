import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader, DisclaimerBar } from "@/components/cite/layout";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider, LocaleUrlSync, useT } from "@/lib/i18n";

function NotFoundComponent() {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:py-28">
      <p className="font-mono text-xs text-muted-foreground">404</p>
      <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-ink">
        {t("notfound.title")}
      </h1>
      <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
        {t("notfound.body")}
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98]"
      >
        {t("notfound.action")}
      </Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cite · Know what applies. And why." },
      {
        name: "description",
        content: "Regulatory intelligence for rental housing, traced to the source.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <LocaleUrlSync />
        <div className="atmosphere flex min-h-dvh flex-col">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:p-3">
            Skip to content / Ir al contenido
          </a>
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="flex-1 pb-28">
            <Outlet />
          </main>
          <DisclaimerBar />
          <Toaster position="bottom-center" closeButton />
        </div>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
