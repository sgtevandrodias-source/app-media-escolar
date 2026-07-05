import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <title>Média CMB</title>

        <meta
          name="description"
          content="App para acompanhar notas, trimestres e recuperação escolar."
        />

        <meta name="theme-color" content="#2563eb" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/logo192.png" />
        <link rel="apple-touch-icon" href="/logo192.png" />

        <ScrollViewStyleReset />
      </head>

      <body>
        {children}

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", function () {
                  navigator.serviceWorker.register("/sw.js").catch(function (error) {
                    console.log("Service worker não registrado:", error);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}