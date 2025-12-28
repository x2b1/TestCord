/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";

enum Format {
    NONE = 0,
    IMAGE = 1,
    VIDEO = 2
}

interface FavoriteButtonProps {
    width: number;
    height: number;
    // Media URL
    src: string;
    // Provider source URL
    url: string;
    format: Format;
    className?: string;
}

const FavoriteButton = findComponentByCodeLazy<FavoriteButtonProps>(
    "#{intl::GIF_TOOLTIP_ADD_TO_FAVORITES}"
);

interface AccessoryProps
    extends Pick<FavoriteButtonProps, "width" | "height" | "url"> {
    proxyUrl?: string;
    video?: boolean;
}

const Classes = findByPropsLazy("gifFavoriteButton", "ctaButtonContainer");

export default definePlugin({
    name: "FavouriteAnything",
    description: "Favourite any image",
    authors: [Devs.nin0dev],
    patches: [
        {
            find: "static isAnimated",
            replacement: [
                {
                    match: /static isAnimated\((\i)\)\{/,
                    replace:
                        "static isAnimated($1,override){if(!override)return true;"
                },
                {
                    match: /(?<=this\.props\.renderAccessory\(\):)null/,
                    replace:
                        "$self.Accessory({...this.props,url:this.props.src,video:true})"
                },
                // Always return static thumbnails for non gif media (mainly videos) to prevent graphical glitches
                {
                    match: /getSrc\(\i\)\{let \i=/,
                    replace: "$&!this.constructor.isAnimated(this.props,true)||"
                },
                // Dont render the GIF tag on non gif media
                {
                    match: "return this.props.shouldRenderAccessory?",
                    replace: "$&!this.constructor.isAnimated(this.props,true)||"
                }
            ]
        },
        {
            find: "renderComponentAccessories",
            replacement: {
                match: /\i=>\(\)=>\{.{200,300}?null\}/,
                replace: "props=>()=>$self.Accessory({...props,video:false})"
            }
        },
        // Add a proxyUrl prop alongside the src prop, which only stores the thumbnail url
        {
            find: '"renderOverlayContent","renderLinkComponent"',
            replacement: {
                match: /src:\i(?=\})/,
                replace: "$&,proxyUrl:this.props.src"
            }
        }
    ],
    Accessory({ url, proxyUrl, width, height, video }: AccessoryProps) {
        if (!width || !height || !url) return null;

        return (
            <FavoriteButton
                format={video ? Format.VIDEO : Format.IMAGE}
                className={Classes?.gifFavoriteButton}
                src={proxyUrl ?? url}
                url={url}
                width={width}
                height={height}
            />
        );
    }
});
