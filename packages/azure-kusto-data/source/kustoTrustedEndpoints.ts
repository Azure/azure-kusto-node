import { CloudSettings } from "./cloudSettings";
import {default as endpointsData} from "./wellKnownKustoEndpoints.json";



/**
 * A helper class to determine which DNS names are "well-known/trusted"'
 * Kusto endpoints. Untrusted endpoints might require additional configuration
 * before they can be used, for security reasons.
 */
class kustoTrustedEndpointsImpl {
    matchers: { [host: string]: FastSuffixMatcher } = {};
    additionalMatcher: FastSuffixMatcher | null = null;
    overrideMatcher: ((host:string) => boolean) | null = null; // We could unify this with matchers, but separating makes debugging easier
   
    constructor () {
        const data = new Map<string,any>(Object.entries(endpointsData.AllowedEndpointsByLogin));
        (data).forEach((key:string, value: any) => {
            const rules = new Array();
            value.AllowedKustoSuffixes.forEach((suffix: string) => rules.push(new MatchRule(suffix, false)));
            value.AllowedKustoHostnames.forEach((hostname: string) => rules.push(new MatchRule(hostname, true)));
            this.matchers[key] = FastSuffixMatcher.create(rules)
        });
    }
      
    /**
     * @param matcher Rules that determine if a hostname is a valid/trusted Kusto endpoint
     *  (replaces existing rules). NuisLocalAddressolicy".
     */
    setOverridePolicy(matcher:((host:string) => boolean)): void {
        this.overrideMatcher = matcher;
    }

    /**
     * Is the endpoint uri trusted?
     *
     * @param url The endpoint to inspect.
     * @param loginEndpoint The login endpoint to check against. If null - default login is retrieved for the given url. 
     */
    async validateTrustedEndpoint(url: URL | string, loginEndpoint: string | null): Promise<void> {
        const login = loginEndpoint 
            ? loginEndpoint 
            : (await CloudSettings.getInstance().getCloudInfoForCluster(url.toString())).LoginEndpoint;
        const uri = typeof(url) === "string" ? new URL(url) : url;
        const host: string = uri.hostname;
        // Check that target hostname is trusted and can accept security token
        this._validateHostnameIsTrusted(host != null ? host : url.toString(), login);
    }

    /**
     * Adds the rules that determine if a hostname is a valid/trusted Kusto endpoint
     * (extends existing rules).
     *
     * @param rules   - A set of rules
     * @param replace - If true nullifies the last added rules
     */
    public addTrustedHosts(rules: MatchRule[], replace: boolean): void {
        if (rules?.length)
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
            const matcher = this.matchers[loginEndpoint];
            if (matcher?.isMatch(hostname)) {
                return;
            }
        }

        const matcher = this.additionalMatcher;
        if (matcher?.isMatch(hostname)) {
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
            for (var i = 0; i < host.length; i++)
            {
                var c = host.charAt(i);
                if (c != '.' && (c < '0' || c > '9'))
                {
                    return false;
                }
            }
            return true;
        }

        return false;
    }
}

export const kustoTrustedEndpoints = new kustoTrustedEndpointsImpl();

export class FastSuffixMatcher {
    _suffixLength: number;
    rules :{ [host: string]: MatchRule[] } = {}
   
    constructor(rules: MatchRule[]) {
        this._suffixLength = Math.min(...rules.map((r: MatchRule)=>r.suffix.length));
        const processedRules: { [host: string]: MatchRule[] } = {};
        rules.forEach((rule)=>{
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
        matchRules.forEach(rule => {
            if (candidate.endsWith(rule.suffix))
            {
                if (candidate.length == rule.suffix.length
                    || !rule.exact) {
                    return true;
                }
            }
        });

        return false;
    }
    
    static createFromExisting(existing: FastSuffixMatcher | null, rules: MatchRule[]): FastSuffixMatcher | null {
        if (!existing?.rules.length) {
            return new FastSuffixMatcher(rules);
        }

        if (!rules){
            return existing;
        }

        return new FastSuffixMatcher(rules.concat(...Object.values(existing.rules)));
    }
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

function getStringTailLowerCase(val: string, tailLength: number) {
    if (tailLength <= 0){
        return ""
    }

    if (tailLength >= val.length){
        return val.toLowerCase()
    }

    return val.substring(val.length - tailLength).toLowerCase();
}
