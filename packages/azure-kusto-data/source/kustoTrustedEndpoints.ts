import {default as endpointsData} from "./wellKnownKustoEndpoints.json";


function getStringTailLowerCase(val: string, tailLength: number) {
    if (tailLength <= 0){
        return ""
    }

    if (tailLength >= val.length){
        return val.toLowerCase()
    }

    return val.substring(val.length - tailLength).toLowerCase();
}

export class MatchRule {
    /// <summary>
    /// The suffix which the candidate must end with in order to match.
    /// </summary>
    suffix: string;

    /// <summary>
    /// Indicates whether the match must be exact (the candidate must
    /// not have any prefix) or not.
    /// </summary>
    exact: boolean;

    constructor (suffix: string, exact: boolean) {
        this.suffix = suffix;
        this.exact = exact;
    }
}

export class FastSuffixMatcher {
    _suffixLength: number;
    rules :{ [host: string]: MatchRule[] } = {}

    constructor(rules: MatchRule[] | null) {
        this._suffixLength = rules ? Math.min(...rules.map((r: MatchRule) => r.suffix.length)) : 0;
        const processedRules: { [host: string]: MatchRule[] } = {};
        rules?.forEach((rule)=>{
            const suffix = getStringTailLowerCase(rule.suffix, this._suffixLength);
            if (!processedRules[suffix]) {
                processedRules[suffix] = [];
            }
            processedRules[suffix].push(rule);
        });
        this.rules = processedRules;
    }

    isMatch(candidate: string): boolean {
        if (candidate.length < this._suffixLength){
            return false
        }
        const matchRules = this.rules[getStringTailLowerCase(candidate, this._suffixLength)];
      
        if (matchRules){
            for (const rule of matchRules) {
                if (candidate.endsWith(rule.suffix))
                {
                    if (candidate.length == rule.suffix.length
                        || !rule.exact) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    static createFromExisting(existing: FastSuffixMatcher | null, rules: MatchRule[] | null): FastSuffixMatcher | null {
        if (!existing || !Object.keys(existing.rules).length) {
            return new FastSuffixMatcher(rules);
        }

        if (!rules){
            return existing;
        }

        return new FastSuffixMatcher(rules.concat(...Object.values(existing.rules)));
    }
}

/**
 * A helper class to determine which DNS names are "well-known/trusted"'
 * Kusto endpoints. Untrusted endpoints might require additional configuration
 * before they can be used, for security reasons.
 */
class KustoTrustedEndpointsImpl {
    matchers: { [host: string]: FastSuffixMatcher } = {};
    additionalMatcher: FastSuffixMatcher | null = null;
    overrideMatcher: ((host:string) => boolean) | null = null; // We could unify this with matchers, but separating makes debugging easier

    constructor () {
        const etr = Object.entries(endpointsData.AllowedEndpointsByLogin);
        for (const [k,v] of etr) {
            const rules = new Array();
            v.AllowedKustoSuffixes.forEach((suffix: string) => rules.push(new MatchRule(suffix, false)));
            v.AllowedKustoHostnames.forEach((hostname: string) => rules.push(new MatchRule(hostname, true)));
            this.matchers[k] = new FastSuffixMatcher(rules);
        }
    }

    /**
     * @param matcher Rules that determine if a hostname is a valid/trusted Kusto endpoint
     *  (replaces existing rules). NuisLocalAddressolicy".
     */
    setOverridePolicy(matcher:((host:string) => boolean) | null): void {
        this.overrideMatcher = matcher;
    }

    /**
     * Is the endpoint uri trusted?
     *
     * @param url The endpoint to inspect.
     * @param loginEndpoint The login endpoint to check against. If null - default login is retrieved for the given url.
     */
    validateTrustedEndpoint(url: URL | string, loginEndpoint: string) {
        const uri = typeof(url) === "string" ? new URL(url) : url;
        const host: string = uri.hostname;
        // Check that target hostname is trusted and can accept security token
        this._validateHostnameIsTrusted(host != null ? host : url.toString(), loginEndpoint);
    }

    /**
     * Adds the rules that determine if a hostname is a valid/trusted Kusto endpoint
     * (extends existing rules).
     *
     * @param rules   - A set of rules
     * @param replace - If true nullifies the last added rules
     */
    public addTrustedHosts(rules: MatchRule[] | null, replace: boolean): void {
        if (!rules?.length)
        {
            if (replace)
            {
                this.additionalMatcher = null;
            }
            return;
        }

        this.additionalMatcher = FastSuffixMatcher.createFromExisting(replace ? null : this.additionalMatcher, rules);
    }

    _validateHostnameIsTrusted(hostname: string, loginEndpoint: string): void {
        // The loopback is unconditionally allowed (since we trust ourselves)
        if (this._isLocalAddress(hostname)) {
            return;
        }

        // Either check the override matcher OR the matcher:
        const override = this.overrideMatcher;
        if (override != null) {
            if (override(hostname)) {
                return;
            }
        } else {
            const matcher = this.matchers[loginEndpoint?.toLowerCase()];
            if (matcher?.isMatch(hostname)) {
                return;
            }
        }

        const additionalMatcher = this.additionalMatcher;
        if (additionalMatcher?.isMatch(hostname)) {
            return;
        }

        throw new Error(
            `Can't communicate with '${hostname}' as this hostname is currently not trusted; please see https://aka.ms/kustotrustedendpoints`);
    }

    _isLocalAddress(host: string): boolean
    {
        if (["localhost","127.0.0.1","::1","[::1]"].find((c)=> c == host))
        {
            return true;
        }

        if (host.startsWith("127.") && host.length <= 15 && host.length >= 9)
        {
            for (let i = 0; i < host.length; i++)
            {
                const ch = host.charAt(i);
                if (ch != '.' && (ch < '0' || ch > '9'))
                {
                    return false;
                }
            }
            return true;
        }

        return false;
    }
}

export const kustoTrustedEndpoints = new KustoTrustedEndpointsImpl();
