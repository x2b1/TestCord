/* eslint-disable simple-header/header*/

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";

const MemberSince = findComponentByCodeLazy(".memberSinceWrapper,");
const classes = findByPropsLazy("interactiveNormal");

export default definePlugin({
    name: "BetterBios",
    authors: [Devs.TheSun],
    description: "Improves Discord's bio redesign",
    patches: [{
        find: ".viewFullBio,",
        replacement: {
            match: /(?<=\(\),\[\i,\i\]=\i\.useState\(!1\),)(.{0,200})className:(\i.{0,50}.maxBioHeight\))(.{0,300})onClick:\(\)=>{.{0,300}}\)}/,
            replace: "[clamp,setClamp] = Vencord.Webpack.Common.React.useState(true)," +
                "$1 className: clamp ? $2 : null" +
                "$3 onClick: () => setClamp(!clamp)"
        }
    },
    {
        find: ".Messages.VIEW_ALL_ROLES,",
        group: true,
        replacement: [{
            match: /(?<=.useState\(null\),)(\i=\i\.useMemo.{0,300})(return null!=\i\?(\i)\.slice.{0,30}\i,\i\])\)/,
            replace: "[clamp, setClamp] = Vencord.Webpack.Common.React.useState(true)," +
                "$1 if (!clamp) return $3;" +
                "$2.concat(clamp))"
        }, {
            match: /onClick:(\i)(?=,className:\i.showMoreButton)/,
            replace: "onClick:() => (() => { try { setClamp(!clamp) } catch { $1() } })()"
        }]
    }, {
        find: /\.BITE_SIZE,onOpenProfile:\i,usernameIcon:/,
        replacement: {
            match: /(?<=profileViewedAnalytics:\i}\),)/,
            replace: "$self.membersSince({...arguments[0]}),"
        }
    }],

    membersSince({ user, guild }) {
        return <>
            <MemberSince
                userId={user.id}
                guildId={guild?.id}
                tooltipDelay={300}
                textClassName={classes.interactiveNormal}
            />
        </>;
    }
});
