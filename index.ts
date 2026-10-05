import { addHook, type PluginMeta } from "@/hook";
import DataCrawlerAdminPage from "./admin/page";

export const PLUGINS: PluginMeta = {
    nx: "data-crawler",
    name: "Data Crawler",
    version: "1.0.0",
    description: "Sitemap data crawler and dynamic XPath scraper with text/gallery extraction and JSON export.",
    author: "System",
    path: "https://github.com/HOTLancerX/data-crawler.git",
    icon: "carbon:cloud-data-ops",
    color: "from-amber-500 to-orange-600",
};

export function register() {
    // ─── Admin Navigation Hook ────────────────────────────────────────────────
    addHook("admin.nav", [
        {
            key: "data-crawler",
            label: "Data Crawler",
            icon: "carbon:cloud-data-ops",
            slug: "data-crawler",
            parent: "",
            position: 28,
        },
    ], PLUGINS.nx);

    // ─── Admin Pages Hook ─────────────────────────────────────────────────────
    addHook("admin.pages", [
        {
            key: "data-crawler",
            label: "Data Crawler",
            path: DataCrawlerAdminPage,
            style: "left",
        },
    ], PLUGINS.nx);
}
