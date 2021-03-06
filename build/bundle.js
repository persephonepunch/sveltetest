
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.22.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var uikit_min = createCommonjsModule(function (module, exports) {
    /*! UIkit 3.4.5-dev.276d6479d | https://www.getuikit.com | (c) 2014 - 2020 YOOtheme | MIT License */

    !function(t,e){module.exports=e();}(commonjsGlobal,function(){var t=Object.prototype,i=t.hasOwnProperty;function l(t,e){return i.call(t,e)}var e={},n=/([a-z\d])([A-Z])/g;function d(t){return t in e||(e[t]=t.replace(n,"$1-$2").toLowerCase()),e[t]}var r=/-(\w)/g;function f(t){return t.replace(r,o)}function o(t,e){return e?e.toUpperCase():""}function p(t){return t.length?o(0,t.charAt(0))+t.slice(1):""}var s=String.prototype,a=s.startsWith||function(t){return 0===this.lastIndexOf(t,0)};function w(t,e){return a.call(t,e)}var h=s.endsWith||function(t){return this.substr(-t.length)===t};function u(t,e){return h.call(t,e)}function c(t,e){return !!~this.indexOf(t,e)}var g=Array.prototype,m=s.includes||c,v=g.includes||c;function b(t,e){return t&&(D(t)?m:v).call(t,e)}var x=g.findIndex||function(t){for(var e=arguments,i=0;i<this.length;i++)if(t.call(e[1],this[i],i,this))return i;return -1};function y(t,e){return x.call(t,e)}var k=Array.isArray;function $(t){return "function"==typeof t}function I(t){return null!==t&&"object"==typeof t}var S=t.toString;function T(t){return "[object Object]"===S.call(t)}function E(t){return I(t)&&t===t.window}function _(t){return I(t)&&9===t.nodeType}function C(t){return I(t)&&!!t.jquery}function A(t){return I(t)&&1<=t.nodeType}function M(t){return I(t)&&1===t.nodeType}function N(t){return S.call(t).match(/^\[object (NodeList|HTMLCollection)\]$/)}function z(t){return "boolean"==typeof t}function D(t){return "string"==typeof t}function B(t){return "number"==typeof t}function P(t){return B(t)||D(t)&&!isNaN(t-parseFloat(t))}function O(t){return !(k(t)?t.length:I(t)&&Object.keys(t).length)}function H(t){return void 0===t}function L(t){return z(t)?t:"true"===t||"1"===t||""===t||"false"!==t&&"0"!==t&&t}function F(t){var e=Number(t);return !isNaN(e)&&e}function j(t){return parseFloat(t)||0}function W(t){return A(t)?t:N(t)||C(t)?t[0]:k(t)?W(t[0]):null}function V(t){return A(t)?[t]:N(t)?g.slice.call(t):k(t)?t.map(W).filter(Boolean):C(t)?t.toArray():[]}function R(t){return E(t)?t:(t=W(t))?(_(t)?t:t.ownerDocument).defaultView:window}function q(t){return k(t)?t:D(t)?t.split(/,(?![^(]*\))/).map(function(t){return P(t)?F(t):L(t.trim())}):[t]}function U(t){return t?u(t,"ms")?j(t):1e3*j(t):0}function Y(t,i){return t===i||I(t)&&I(i)&&Object.keys(t).length===Object.keys(i).length&&J(t,function(t,e){return t===i[e]})}function X(t,e,i){return t.replace(new RegExp(e+"|"+i,"g"),function(t){return t===e?i:e})}var G=Object.assign||function(t){for(var e=[],i=arguments.length-1;0<i--;)e[i]=arguments[i+1];t=Object(t);for(var n=0;n<e.length;n++){var r=e[n];if(null!==r)for(var o in r)l(r,o)&&(t[o]=r[o]);}return t};function K(t){return t[t.length-1]}function J(t,e){for(var i in t)if(!1===e(t[i],i))return !1;return !0}function Z(t,r){return t.sort(function(t,e){var i=t[r];void 0===i&&(i=0);var n=e[r];return void 0===n&&(n=0),n<i?1:i<n?-1:0})}function Q(t,i){var n=new Set;return t.filter(function(t){var e=t[i];return !n.has(e)&&(n.add(e)||!0)})}function tt(t,e,i){return void 0===e&&(e=0),void 0===i&&(i=1),Math.min(Math.max(F(t)||0,e),i)}function et(){}function it(t,e){return t.left<e.right&&t.right>e.left&&t.top<e.bottom&&t.bottom>e.top}function nt(t,e){return t.x<=e.right&&t.x>=e.left&&t.y<=e.bottom&&t.y>=e.top}var rt={ratio:function(t,e,i){var n,r="width"===e?"height":"width";return (n={})[r]=t[e]?Math.round(i*t[r]/t[e]):t[r],n[e]=i,n},contain:function(i,n){var r=this;return J(i=G({},i),function(t,e){return i=i[e]>n[e]?r.ratio(i,e,n[e]):i}),i},cover:function(i,n){var r=this;return J(i=this.contain(i,n),function(t,e){return i=i[e]<n[e]?r.ratio(i,e,n[e]):i}),i}};function ot(t,e,i){if(I(e))for(var n in e)ot(t,n,e[n]);else {if(H(i))return (t=W(t))&&t.getAttribute(e);V(t).forEach(function(t){$(i)&&(i=i.call(t,ot(t,e))),null===i?at(t,e):t.setAttribute(e,i);});}}function st(t,e){return V(t).some(function(t){return t.hasAttribute(e)})}function at(t,e){t=V(t),e.split(" ").forEach(function(e){return t.forEach(function(t){return t.hasAttribute(e)&&t.removeAttribute(e)})});}function ht(t,e){for(var i=0,n=[e,"data-"+e];i<n.length;i++)if(st(t,n[i]))return ot(t,n[i])}var ut="undefined"!=typeof window,ct=ut&&/msie|trident/i.test(window.navigator.userAgent),lt=ut&&"rtl"===ot(document.documentElement,"dir"),dt=ut&&"ontouchstart"in window,ft=ut&&window.PointerEvent,pt=ut&&(dt||window.DocumentTouch&&document instanceof DocumentTouch||navigator.maxTouchPoints),gt=ft?"pointerdown":dt?"touchstart":"mousedown",mt=ft?"pointermove":dt?"touchmove":"mousemove",vt=ft?"pointerup":dt?"touchend":"mouseup",wt=ft?"pointerenter":dt?"":"mouseenter",bt=ft?"pointerleave":dt?"":"mouseleave",xt=ft?"pointercancel":"touchcancel";function yt(t,e){return W(t)||It(t,$t(t,e))}function kt(t,e){var i=V(t);return i.length&&i||St(t,$t(t,e))}function $t(t,e){return void 0===e&&(e=document),Ct(t)||_(e)?e:e.ownerDocument}function It(t,e){return W(Tt(t,e,"querySelector"))}function St(t,e){return V(Tt(t,e,"querySelectorAll"))}function Tt(t,s,e){if(void 0===s&&(s=document),!t||!D(t))return null;var a;Ct(t=t.replace(_t,"$1 *"))&&(a=[],t=t.match(At).map(function(t){return t.replace(/,$/,"").trim()}).map(function(t,e){var i=s;if("!"===t[0]){var n=t.substr(1).trim().split(" ");i=Bt(Pt(s),n[0]),t=n.slice(1).join(" ").trim();}if("-"===t[0]){var r=t.substr(1).trim().split(" "),o=(i||s).previousElementSibling;i=zt(o,t.substr(1))?o:null,t=r.slice(1).join(" ");}return i?(i.id||(i.id="uk-"+Date.now()+e,a.push(function(){return at(i,"id")})),"#"+Ht(i.id)+" "+t):null}).filter(Boolean).join(","),s=document);try{return s[e](t)}catch(t){return null}finally{a&&a.forEach(function(t){return t()});}}var Et=/(^|[^\\],)\s*[!>+~-]/,_t=/([!>+~-])(?=\s+[!>+~-]|\s*$)/g;function Ct(t){return D(t)&&t.match(Et)}var At=/.*?[^\\](?:,|$)/g;var Mt=ut?Element.prototype:{},Nt=Mt.matches||Mt.webkitMatchesSelector||Mt.msMatchesSelector||et;function zt(t,e){return V(t).some(function(t){return Nt.call(t,e)})}var Dt=Mt.closest||function(t){var e=this;do{if(zt(e,t))return e}while(e=Pt(e))};function Bt(t,e){return w(e,">")&&(e=e.slice(1)),M(t)?Dt.call(t,e):V(t).map(function(t){return Bt(t,e)}).filter(Boolean)}function Pt(t){return (t=W(t))&&M(t.parentNode)&&t.parentNode}var Ot=ut&&window.CSS&&CSS.escape||function(t){return t.replace(/([^\x7f-\uFFFF\w-])/g,function(t){return "\\"+t})};function Ht(t){return D(t)?Ot.call(null,t):""}var Lt={area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,menuitem:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0};function Ft(t){return V(t).some(function(t){return Lt[t.tagName.toLowerCase()]})}function jt(t){return V(t).some(function(t){return t.offsetWidth||t.offsetHeight||t.getClientRects().length})}var Wt="input,select,textarea,button";function Vt(t){return V(t).some(function(t){return zt(t,Wt)})}function Rt(t,e){return V(t).filter(function(t){return zt(t,e)})}function qt(t,e){return D(e)?zt(t,e)||Bt(t,e):t===e||(_(e)?e.documentElement:W(e)).contains(W(t))}function Ut(t,e){for(var i=[];t=Pt(t);)e&&!zt(t,e)||i.push(t);return i}function Yt(t,e){var i=(t=W(t))?V(t.children):[];return e?Rt(i,e):i}function Xt(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];var i,n,r=Qt(t),o=r[0],s=r[1],a=r[2],h=r[3],u=r[4];return o=ne(o),1<h.length&&(i=h,h=function(t){return k(t.detail)?i.apply(void 0,[t].concat(t.detail)):i(t)}),u&&u.self&&(n=h,h=function(t){if(t.target===t.currentTarget||t.target===t.current)return n.call(null,t)}),a&&(h=function(t,n,r){var o=this;return function(i){t.forEach(function(t){var e=">"===n[0]?St(n,t).reverse().filter(function(t){return qt(i.target,t)})[0]:Bt(i.target,n);e&&(i.delegate=t,i.current=e,r.call(o,i));});}}(o,a,h)),u=te(u),s.split(" ").forEach(function(e){return o.forEach(function(t){return t.addEventListener(e,h,u)})}),function(){return Gt(o,s,h,u)}}function Gt(t,e,i,n){void 0===n&&(n=!1),n=te(n),t=ne(t),e.split(" ").forEach(function(e){return t.forEach(function(t){return t.removeEventListener(e,i,n)})});}function Kt(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];var i=Qt(t),n=i[0],r=i[1],o=i[2],s=i[3],a=i[4],h=i[5],u=Xt(n,r,o,function(t){var e=!h||h(t);e&&(u(),s(t,e));},a);return u}function Jt(t,i,n){return ne(t).reduce(function(t,e){return t&&e.dispatchEvent(Zt(i,!0,!0,n))},!0)}function Zt(t,e,i,n){if(void 0===e&&(e=!0),void 0===i&&(i=!1),D(t)){var r=document.createEvent("CustomEvent");r.initCustomEvent(t,e,i,n),t=r;}return t}function Qt(t){return $(t[2])&&t.splice(2,0,!1),t}function te(t){return t&&ct&&!z(t)?!!t.capture:t}function ee(t){return t&&"addEventListener"in t}function ie(t){return ee(t)?t:W(t)}function ne(t){return k(t)?t.map(ie).filter(Boolean):D(t)?St(t):ee(t)?[t]:V(t)}function re(t){return "touch"===t.pointerType||!!t.touches}function oe(t){var e=t.touches,i=t.changedTouches,n=e&&e[0]||i&&i[0]||t;return {x:n.clientX,y:n.clientY}}function se(){var i=this;this.promise=new ae(function(t,e){i.reject=e,i.resolve=t;});}var ae=ut&&window.Promise||ce,he=2,ue=ut&&window.setImmediate||setTimeout;function ce(t){this.state=he,this.value=void 0,this.deferred=[];var e=this;try{t(function(t){e.resolve(t);},function(t){e.reject(t);});}catch(t){e.reject(t);}}ce.reject=function(i){return new ce(function(t,e){e(i);})},ce.resolve=function(i){return new ce(function(t,e){t(i);})},ce.all=function(s){return new ce(function(i,t){var n=[],r=0;function e(e){return function(t){n[e]=t,(r+=1)===s.length&&i(n);}}0===s.length&&i(n);for(var o=0;o<s.length;o+=1)ce.resolve(s[o]).then(e(o),t);})},ce.race=function(n){return new ce(function(t,e){for(var i=0;i<n.length;i+=1)ce.resolve(n[i]).then(t,e);})};var le=ce.prototype;function de(s,a){return new ae(function(t,e){var i=G({data:null,method:"GET",headers:{},xhr:new XMLHttpRequest,beforeSend:et,responseType:""},a);i.beforeSend(i);var n=i.xhr;for(var r in i)if(r in n)try{n[r]=i[r];}catch(t){}for(var o in n.open(i.method.toUpperCase(),s),i.headers)n.setRequestHeader(o,i.headers[o]);Xt(n,"load",function(){0===n.status||200<=n.status&&n.status<300||304===n.status?t(n):e(G(Error(n.statusText),{xhr:n,status:n.status}));}),Xt(n,"error",function(){return e(G(Error("Network Error"),{xhr:n}))}),Xt(n,"timeout",function(){return e(G(Error("Network Timeout"),{xhr:n}))}),n.send(i.data);})}function fe(n,r,o){return new ae(function(t,e){var i=new Image;i.onerror=e,i.onload=function(){return t(i)},o&&(i.sizes=o),r&&(i.srcset=r),i.src=n;})}function pe(t){if("loading"===document.readyState)var e=Xt(document,"DOMContentLoaded",function(){e(),t();});else t();}function ge(t,e){return e?V(t).indexOf(W(e)):Yt(Pt(t)).indexOf(t)}function me(t,e,i,n){void 0===i&&(i=0),void 0===n&&(n=!1);var r=(e=V(e)).length;return t=P(t)?F(t):"next"===t?i+1:"previous"===t?i-1:ge(e,t),n?tt(t,0,r-1):(t%=r)<0?t+r:t}function ve(t){return (t=Me(t)).innerHTML="",t}function we(t,e){return t=Me(t),H(e)?t.innerHTML:be(t.hasChildNodes()?ve(t):t,e)}function be(e,t){return e=Me(e),ke(t,function(t){return e.appendChild(t)})}function xe(e,t){return e=Me(e),ke(t,function(t){return e.parentNode.insertBefore(t,e)})}function ye(e,t){return e=Me(e),ke(t,function(t){return e.nextSibling?xe(e.nextSibling,t):be(e.parentNode,t)})}function ke(t,e){return (t=D(t)?Ce(t):t)?"length"in t?V(t).map(e):e(t):null}function $e(t){V(t).map(function(t){return t.parentNode&&t.parentNode.removeChild(t)});}function Ie(t,e){for(e=W(xe(t,e));e.firstChild;)e=e.firstChild;return be(e,t),e}function Se(t,e){return V(V(t).map(function(t){return t.hasChildNodes?Ie(V(t.childNodes),e):be(t,e)}))}function Te(t){V(t).map(Pt).filter(function(t,e,i){return i.indexOf(t)===e}).forEach(function(t){xe(t,t.childNodes),$e(t);});}le.resolve=function(t){var e=this;if(e.state===he){if(t===e)throw new TypeError("Promise settled with itself.");var i=!1;try{var n=t&&t.then;if(null!==t&&I(t)&&$(n))return void n.call(t,function(t){i||e.resolve(t),i=!0;},function(t){i||e.reject(t),i=!0;})}catch(t){return void(i||e.reject(t))}e.state=0,e.value=t,e.notify();}},le.reject=function(t){var e=this;if(e.state===he){if(t===e)throw new TypeError("Promise settled with itself.");e.state=1,e.value=t,e.notify();}},le.notify=function(){var o=this;ue(function(){if(o.state!==he)for(;o.deferred.length;){var t=o.deferred.shift(),e=t[0],i=t[1],n=t[2],r=t[3];try{0===o.state?$(e)?n(e.call(void 0,o.value)):n(o.value):1===o.state&&($(i)?n(i.call(void 0,o.value)):r(o.value));}catch(t){r(t);}}});},le.then=function(i,n){var r=this;return new ce(function(t,e){r.deferred.push([i,n,t,e]),r.notify();})},le.catch=function(t){return this.then(void 0,t)};var Ee=/^\s*<(\w+|!)[^>]*>/,_e=/^<(\w+)\s*\/?>(?:<\/\1>)?$/;function Ce(t){var e=_e.exec(t);if(e)return document.createElement(e[1]);var i=document.createElement("div");return Ee.test(t)?i.insertAdjacentHTML("beforeend",t.trim()):i.textContent=t,1<i.childNodes.length?V(i.childNodes):i.firstChild}function Ae(t,e){if(M(t))for(e(t),t=t.firstElementChild;t;){var i=t.nextElementSibling;Ae(t,e),t=i;}}function Me(t,e){return D(t)?ze(t)?W(Ce(t)):It(t,e):W(t)}function Ne(t,e){return D(t)?ze(t)?V(Ce(t)):St(t,e):V(t)}function ze(t){return "<"===t[0]||t.match(/^\s*</)}function De(t){for(var e=[],i=arguments.length-1;0<i--;)e[i]=arguments[i+1];Fe(t,e,"add");}function Be(t){for(var e=[],i=arguments.length-1;0<i--;)e[i]=arguments[i+1];Fe(t,e,"remove");}function Pe(t,e){ot(t,"class",function(t){return (t||"").replace(new RegExp("\\b"+e+"\\b","g"),"")});}function Oe(t){for(var e=[],i=arguments.length-1;0<i--;)e[i]=arguments[i+1];e[0]&&Be(t,e[0]),e[1]&&De(t,e[1]);}function He(t,e){return e&&V(t).some(function(t){return t.classList.contains(e.split(" ")[0])})}function Le(t){for(var n=[],e=arguments.length-1;0<e--;)n[e]=arguments[e+1];if(n.length){var r=D(K(n=je(n)))?[]:n.pop();n=n.filter(Boolean),V(t).forEach(function(t){for(var e=t.classList,i=0;i<n.length;i++)We.Force?e.toggle.apply(e,[n[i]].concat(r)):e[(H(r)?!e.contains(n[i]):r)?"add":"remove"](n[i]);});}}function Fe(t,i,n){(i=je(i).filter(Boolean)).length&&V(t).forEach(function(t){var e=t.classList;We.Multiple?e[n].apply(e,i):i.forEach(function(t){return e[n](t)});});}function je(t){return t.reduce(function(t,e){return t.concat.call(t,D(e)&&b(e," ")?e.trim().split(" "):e)},[])}var We={get Multiple(){return this.get("_multiple")},get Force(){return this.get("_force")},get:function(t){if(!l(this,t)){var e=document.createElement("_").classList;e.add("a","b"),e.toggle("c",!1),this._multiple=e.contains("b"),this._force=!e.contains("c");}return this[t]}},Ve={"animation-iteration-count":!0,"column-count":!0,"fill-opacity":!0,"flex-grow":!0,"flex-shrink":!0,"font-weight":!0,"line-height":!0,opacity:!0,order:!0,orphans:!0,"stroke-dasharray":!0,"stroke-dashoffset":!0,widows:!0,"z-index":!0,zoom:!0};function Re(t,e,r){return V(t).map(function(i){if(D(e)){if(e=Ke(e),H(r))return Ue(i,e);r||B(r)?i.style[e]=P(r)&&!Ve[e]?r+"px":r:i.style.removeProperty(e);}else {if(k(e)){var n=qe(i);return e.reduce(function(t,e){return t[e]=n[Ke(e)],t},{})}I(e)&&J(e,function(t,e){return Re(i,e,t)});}return i})[0]}function qe(t,e){return (t=W(t)).ownerDocument.defaultView.getComputedStyle(t,e)}function Ue(t,e,i){return qe(t,i)[e]}var Ye={};function Xe(t){var e=document.documentElement;if(!ct)return qe(e).getPropertyValue("--uk-"+t);if(!(t in Ye)){var i=be(e,document.createElement("div"));De(i,"uk-"+t),Ye[t]=Ue(i,"content",":before").replace(/^["'](.*)["']$/,"$1"),$e(i);}return Ye[t]}var Ge={};function Ke(t){var e=Ge[t];return e=e||(Ge[t]=function(t){t=d(t);var e=document.documentElement.style;if(t in e)return t;var i,n=Je.length;for(;n--;)if((i="-"+Je[n]+"-"+t)in e)return i}(t)||t)}var Je=["webkit","moz","ms"];function Ze(t,s,a,h){return void 0===a&&(a=400),void 0===h&&(h="linear"),ae.all(V(t).map(function(o){return new ae(function(i,n){for(var t in s){var e=Re(o,t);""===e&&Re(o,t,e);}var r=setTimeout(function(){return Jt(o,"transitionend")},a);Kt(o,"transitionend transitioncanceled",function(t){var e=t.type;clearTimeout(r),Be(o,"uk-transition"),Re(o,{transitionProperty:"",transitionDuration:"",transitionTimingFunction:""}),("transitioncanceled"===e?n:i)();},{self:!0}),De(o,"uk-transition"),Re(o,G({transitionProperty:Object.keys(s).map(Ke).join(","),transitionDuration:a+"ms",transitionTimingFunction:h},s));})}))}var Qe={start:Ze,stop:function(t){return Jt(t,"transitionend"),ae.resolve()},cancel:function(t){Jt(t,"transitioncanceled");},inProgress:function(t){return He(t,"uk-transition")}},ti="uk-animation-";function ei(t,r,o,s,a){return void 0===o&&(o=200),ae.all(V(t).map(function(t){return new ae(function(e,i){function n(){Re(t,"animationDuration",""),Pe(t,ti+"\\S*");}n(),Kt(t,"animationend animationcancel",function(t){("animationcancel"===t.type?i:e)(),n();},{self:!0}),Re(t,"animationDuration",o+"ms"),De(t,r,ti+(a?"leave":"enter")),w(r,ti)&&De(t,s&&"uk-transform-origin-"+s,a&&ti+"reverse");})}))}var ii=new RegExp(ti+"(enter|leave)"),ni={in:function(t,e,i,n){return ei(t,e,i,n,!1)},out:function(t,e,i,n){return ei(t,e,i,n,!0)},inProgress:function(t){return ii.test(ot(t,"class"))},cancel:function(t){Jt(t,"animationcancel");}},ri={width:["x","left","right"],height:["y","top","bottom"]};function oi(t,e,c,l,d,i,n,r){c=gi(c),l=gi(l);var f={element:c,target:l};if(!t||!e)return f;var p=ai(t),g=ai(e),m=g;if(pi(m,c,p,-1),pi(m,l,g,1),d=mi(d,p.width,p.height),i=mi(i,g.width,g.height),d.x+=i.x,d.y+=i.y,m.left+=d.x,m.top+=d.y,n){var o=[ai(R(t))];r&&o.unshift(ai(r)),J(ri,function(t,s){var a=t[0],h=t[1],u=t[2];!0!==n&&!b(n,a)||o.some(function(n){var t=c[a]===h?-p[s]:c[a]===u?p[s]:0,e=l[a]===h?g[s]:l[a]===u?-g[s]:0;if(m[h]<n[h]||m[h]+p[s]>n[u]){var i=p[s]/2,r="center"===l[a]?-g[s]/2:0;return "center"===c[a]&&(o(i,r)||o(-i,-r))||o(t,e)}function o(e,t){var i=m[h]+e+t-2*d[a];if(i>=n[h]&&i+p[s]<=n[u])return m[h]=i,["element","target"].forEach(function(t){f[t][a]=e?f[t][a]===ri[s][1]?ri[s][2]:ri[s][1]:f[t][a];}),!0}});});}return si(t,m),f}function si(i,n){if(!n)return ai(i);var r=si(i),o=Re(i,"position");["left","top"].forEach(function(t){if(t in n){var e=Re(i,t);Re(i,t,n[t]-r[t]+j("absolute"===o&&"auto"===e?hi(i)[t]:e));}});}function ai(t){if(!t)return {};var e,i,n=R(t),r=n.pageYOffset,o=n.pageXOffset;if(E(t)){var s=t.innerHeight,a=t.innerWidth;return {top:r,left:o,height:s,width:a,bottom:r+s,right:o+a}}jt(t)||"none"!==Re(t,"display")||(e=ot(t,"style"),i=ot(t,"hidden"),ot(t,{style:(e||"")+";display:block !important;",hidden:null}));var h=(t=W(t)).getBoundingClientRect();return H(e)||ot(t,{style:e,hidden:i}),{height:h.height,width:h.width,top:h.top+r,left:h.left+o,bottom:h.bottom+r,right:h.right+o}}function hi(t,e){e=e||W(t).offsetParent||R(t).document.documentElement;var i=si(t),n=si(e);return {top:i.top-n.top-j(Re(e,"borderTopWidth")),left:i.left-n.left-j(Re(e,"borderLeftWidth"))}}function ui(t){var e=[0,0];t=W(t);do{if(e[0]+=t.offsetTop,e[1]+=t.offsetLeft,"fixed"===Re(t,"position")){var i=R(t);return e[0]+=i.pageYOffset,e[1]+=i.pageXOffset,e}}while(t=t.offsetParent);return e}var ci=di("height"),li=di("width");function di(n){var r=p(n);return function(t,e){if(H(e)){if(E(t))return t["inner"+r];if(_(t)){var i=t.documentElement;return Math.max(i["offset"+r],i["scroll"+r])}return (e="auto"===(e=Re(t=W(t),n))?t["offset"+r]:j(e)||0)-fi(t,n)}Re(t,n,e||0===e?+e+fi(t,n)+"px":"");}}function fi(i,t,e){return void 0===e&&(e="border-box"),Re(i,"boxSizing")===e?ri[t].slice(1).map(p).reduce(function(t,e){return t+j(Re(i,"padding"+e))+j(Re(i,"border"+e+"Width"))},0):0}function pi(o,s,a,h){J(ri,function(t,e){var i=t[0],n=t[1],r=t[2];s[i]===r?o[n]+=a[e]*h:"center"===s[i]&&(o[n]+=a[e]*h/2);});}function gi(t){var e=/left|center|right/,i=/top|center|bottom/;return 1===(t=(t||"").split(" ")).length&&(t=e.test(t[0])?t.concat("center"):i.test(t[0])?["center"].concat(t):["center","center"]),{x:e.test(t[0])?t[0]:"center",y:i.test(t[1])?t[1]:"center"}}function mi(t,e,i){var n=(t||"").split(" "),r=n[0],o=n[1];return {x:r?j(r)*(u(r,"%")?e/100:1):0,y:o?j(o)*(u(o,"%")?i/100:1):0}}function vi(t){switch(t){case"left":return "right";case"right":return "left";case"top":return "bottom";case"bottom":return "top";default:return t}}function wi(t,e,i){return void 0===e&&(e="width"),void 0===i&&(i=window),P(t)?+t:u(t,"vh")?bi(ci(R(i)),t):u(t,"vw")?bi(li(R(i)),t):u(t,"%")?bi(ai(i)[e],t):j(t)}function bi(t,e){return t*j(e)/100}var xi={reads:[],writes:[],read:function(t){return this.reads.push(t),$i(),t},write:function(t){return this.writes.push(t),$i(),t},clear:function(t){return Si(this.reads,t)||Si(this.writes,t)},flush:yi};function yi(t){void 0===t&&(t=1),Ii(xi.reads),Ii(xi.writes.splice(0,xi.writes.length)),xi.scheduled=!1,(xi.reads.length||xi.writes.length)&&$i(t+1);}var ki=5;function $i(t){if(!xi.scheduled){if(xi.scheduled=!0,ki<t)throw new Error("Maximum recursion limit reached.");t?ae.resolve().then(function(){return yi(t)}):requestAnimationFrame(function(){return yi()});}}function Ii(t){for(var e;e=t.shift();)e();}function Si(t,e){var i=t.indexOf(e);return !!~i&&!!t.splice(i,1)}function Ti(){}Ti.prototype={positions:[],init:function(){var e,t=this;this.positions=[],this.unbind=Xt(document,"mousemove",function(t){return e=oe(t)}),this.interval=setInterval(function(){e&&(t.positions.push(e),5<t.positions.length&&t.positions.shift());},50);},cancel:function(){this.unbind&&this.unbind(),this.interval&&clearInterval(this.interval);},movesTo:function(t){if(this.positions.length<2)return !1;var i=t.getBoundingClientRect(),e=i.left,n=i.right,r=i.top,o=i.bottom,s=this.positions[0],a=K(this.positions),h=[s,a];return !nt(a,i)&&[[{x:e,y:r},{x:n,y:o}],[{x:e,y:o},{x:n,y:r}]].some(function(t){var e=function(t,e){var i=t[0],n=i.x,r=i.y,o=t[1],s=o.x,a=o.y,h=e[0],u=h.x,c=h.y,l=e[1],d=l.x,f=l.y,p=(f-c)*(s-n)-(d-u)*(a-r);if(0==p)return !1;var g=((d-u)*(r-c)-(f-c)*(n-u))/p;if(g<0)return !1;return {x:n+g*(s-n),y:r+g*(a-r)}}(h,t);return e&&nt(e,i)})}};var Ei={};function _i(t,e,i){return Ei.computed($(t)?t.call(i,i):t,$(e)?e.call(i,i):e)}function Ci(t,e){return t=t&&!k(t)?[t]:t,e?t?t.concat(e):k(e)?e:[e]:t}function Ai(e,i,n){var r={};if($(i)&&(i=i.options),i.extends&&(e=Ai(e,i.extends,n)),i.mixins)for(var t=0,o=i.mixins.length;t<o;t++)e=Ai(e,i.mixins[t],n);for(var s in e)h(s);for(var a in i)l(e,a)||h(a);function h(t){r[t]=(Ei[t]||function(t,e){return H(e)?t:e})(e[t],i[t],n);}return r}function Mi(t,e){var i;void 0===e&&(e=[]);try{return t?w(t,"{")?JSON.parse(t):e.length&&!b(t,":")?((i={})[e[0]]=t,i):t.split(";").reduce(function(t,e){var i=e.split(/:(.*)/),n=i[0],r=i[1];return n&&!H(r)&&(t[n.trim()]=r.trim()),t},{}):{}}catch(t){return {}}}Ei.events=Ei.created=Ei.beforeConnect=Ei.connected=Ei.beforeDisconnect=Ei.disconnected=Ei.destroy=Ci,Ei.args=function(t,e){return !1!==e&&Ci(e||t)},Ei.update=function(t,e){return Z(Ci(t,$(e)?{read:e}:e),"order")},Ei.props=function(t,e){return k(e)&&(e=e.reduce(function(t,e){return t[e]=String,t},{})),Ei.methods(t,e)},Ei.computed=Ei.methods=function(t,e){return e?t?G({},t,e):e:t},Ei.data=function(e,i,t){return t?_i(e,i,t):i?e?function(t){return _i(e,i,t)}:i:e};function Ni(t){this.id=++zi,this.el=W(t);}var zi=0;function Di(t,e){try{t.contentWindow.postMessage(JSON.stringify(G({event:"command"},e)),"*");}catch(t){}}function Bi(h,u,c){if(void 0===u&&(u=0),void 0===c&&(c=0),!jt(h))return !1;var l=ji(h);return l.every(function(t,e){var i=si(l[e+1]||h),n=si(Fi(t)),r=n.top,o=n.left,s=n.bottom,a=n.right;return it(i,{top:r-u,left:o-c,bottom:s+u,right:a+c})})}function Pi(t,e){(t=(E(t)||_(t)?Wi:W)(t)).scrollTop=e;}function Oi(t,e){void 0===e&&(e={});var c=e.offset;if(void 0===c&&(c=0),jt(t)){for(var l=ji(t).concat(t),i=ae.resolve(),n=function(u){i=i.then(function(){return new ae(function(i){var t,n=l[u],e=l[u+1],r=n.scrollTop,o=Math.ceil(hi(e,Fi(n)).top-c),s=(t=Math.abs(o),40*Math.pow(t,.375)),a=Date.now(),h=function(){var t,e=(t=tt((Date.now()-a)/s),.5*(1-Math.cos(Math.PI*t)));Pi(n,r+o*e),1!=e?requestAnimationFrame(h):i();};h();})});},r=0;r<l.length-1;r++)n(r);return i}}function Hi(t,e){if(void 0===e&&(e=0),!jt(t))return 0;var i=K(Li(t)),n=i.scrollHeight,r=i.scrollTop,o=si(Fi(i)).height,s=ui(t)[0]-r-ui(i)[0],a=Math.min(o,s+r);return tt(-1*(s-a)/Math.min(si(t).height+e+a,n-(s+r),n-o))}function Li(t,e){void 0===e&&(e=/auto|scroll/);var i=Wi(t),n=Ut(t).filter(function(t){return t===i||e.test(Re(t,"overflow"))&&t.scrollHeight>Math.round(si(t).height)}).reverse();return n.length?n:[i]}function Fi(t){return t===Wi(t)?window:t}function ji(t){return Li(t,/auto|scroll|hidden/)}function Wi(t){var e=R(t).document;return e.scrollingElement||e.documentElement}Ni.prototype.isVideo=function(){return this.isYoutube()||this.isVimeo()||this.isHTML5()},Ni.prototype.isHTML5=function(){return "VIDEO"===this.el.tagName},Ni.prototype.isIFrame=function(){return "IFRAME"===this.el.tagName},Ni.prototype.isYoutube=function(){return this.isIFrame()&&!!this.el.src.match(/\/\/.*?youtube(-nocookie)?\.[a-z]+\/(watch\?v=[^&\s]+|embed)|youtu\.be\/.*/)},Ni.prototype.isVimeo=function(){return this.isIFrame()&&!!this.el.src.match(/vimeo\.com\/video\/.*/)},Ni.prototype.enableApi=function(){var e=this;if(this.ready)return this.ready;var i,r=this.isYoutube(),o=this.isVimeo();return r||o?this.ready=new ae(function(t){var n;Kt(e.el,"load",function(){if(r){var t=function(){return Di(e.el,{event:"listening",id:e.id})};i=setInterval(t,100),t();}}),n=function(t){return r&&t.id===e.id&&"onReady"===t.event||o&&Number(t.player_id)===e.id},new ae(function(i){return Kt(window,"message",function(t,e){return i(e)},!1,function(t){var e=t.data;if(e&&D(e)){try{e=JSON.parse(e);}catch(t){return}return e&&n(e)}})}).then(function(){t(),i&&clearInterval(i);}),ot(e.el,"src",e.el.src+(b(e.el.src,"?")?"&":"?")+(r?"enablejsapi=1":"api=1&player_id="+e.id));}):ae.resolve()},Ni.prototype.play=function(){var t=this;if(this.isVideo())if(this.isIFrame())this.enableApi().then(function(){return Di(t.el,{func:"playVideo",method:"play"})});else if(this.isHTML5())try{var e=this.el.play();e&&e.catch(et);}catch(t){}},Ni.prototype.pause=function(){var t=this;this.isVideo()&&(this.isIFrame()?this.enableApi().then(function(){return Di(t.el,{func:"pauseVideo",method:"pause"})}):this.isHTML5()&&this.el.pause());},Ni.prototype.mute=function(){var t=this;this.isVideo()&&(this.isIFrame()?this.enableApi().then(function(){return Di(t.el,{func:"mute",method:"setVolume",value:0})}):this.isHTML5()&&(this.el.muted=!0,ot(this.el,"muted","")));};var Vi=ut&&window.IntersectionObserver||function(){function t(e,t){var i=this;void 0===t&&(t={});var n=t.rootMargin;void 0===n&&(n="0 0"),this.targets=[];var r,o=(n||"0 0").split(" ").map(j),s=o[0],a=o[1];this.offsetTop=s,this.offsetLeft=a,this.apply=function(){r=r||requestAnimationFrame(function(){return setTimeout(function(){var t=i.takeRecords();t.length&&e(t,i),r=!1;})});},this.off=Xt(window,"scroll resize load",this.apply,{passive:!0,capture:!0});}return t.prototype.takeRecords=function(){var i=this;return this.targets.filter(function(t){var e=Bi(t.target,i.offsetTop,i.offsetLeft);if(null===t.isIntersecting||e^t.isIntersecting)return t.isIntersecting=e,!0})},t.prototype.observe=function(t){this.targets.push({target:t,isIntersecting:null}),this.apply();},t.prototype.disconnect=function(){this.targets=[],this.off();},t}();function Ri(t){return !(!w(t,"uk-")&&!w(t,"data-uk-"))&&f(t.replace("data-uk-","").replace("uk-",""))}function qi(t){this._init(t);}var Ui,Yi,Xi,Gi,Ki,Ji,Zi,Qi,tn;function en(t,e){if(t)for(var i in t)t[i]._connected&&t[i]._callUpdate(e);}function nn(t,e){var i={},n=t.args;void 0===n&&(n=[]);var r=t.props;void 0===r&&(r={});var o=t.el;if(!r)return i;for(var s in r){var a=d(s),h=ht(o,a);H(h)||(h=r[s]===Boolean&&""===h||an(r[s],h),("target"!==a||h&&!w(h,"_"))&&(i[s]=h));}var u=Mi(ht(o,e),n);for(var c in u){var l=f(c);void 0!==r[l]&&(i[l]=an(r[l],u[c]));}return i}function rn(n,r,o){Object.defineProperty(n,r,{enumerable:!0,get:function(){var t=n._computeds,e=n.$props,i=n.$el;return l(t,r)||(t[r]=(o.get||o).call(n,e,i)),t[r]},set:function(t){var e=n._computeds;e[r]=o.set?o.set.call(n,t):t,H(e[r])&&delete e[r];}});}function on(e,i,n){T(i)||(i={name:n,handler:i});var t=i.name,r=i.el,o=i.handler,s=i.capture,a=i.passive,h=i.delegate,u=i.filter,c=i.self;r=$(r)?r.call(e):r||e.$el,k(r)?r.forEach(function(t){return on(e,G({},i,{el:t}),n)}):!r||u&&!u.call(e)||e._events.push(Xt(r,t,h?D(h)?h:h.call(e):null,D(o)?e[o]:o.bind(e),{passive:a,capture:s,self:c}));}function sn(t,e){return t.every(function(t){return !t||!l(t,e)})}function an(t,e){return t===Boolean?L(e):t===Number?F(e):"list"===t?q(e):t?t(e):e}qi.util=Object.freeze({__proto__:null,ajax:de,getImage:fe,transition:Ze,Transition:Qe,animate:ei,Animation:ni,attr:ot,hasAttr:st,removeAttr:at,data:ht,addClass:De,removeClass:Be,removeClasses:Pe,replaceClass:Oe,hasClass:He,toggleClass:Le,positionAt:oi,offset:si,position:hi,offsetPosition:ui,height:ci,width:li,boxModelAdjust:fi,flipPosition:vi,toPx:wi,ready:pe,index:ge,getIndex:me,empty:ve,html:we,prepend:function(e,t){return (e=Me(e)).hasChildNodes()?ke(t,function(t){return e.insertBefore(t,e.firstChild)}):be(e,t)},append:be,before:xe,after:ye,remove:$e,wrapAll:Ie,wrapInner:Se,unwrap:Te,fragment:Ce,apply:Ae,$:Me,$$:Ne,inBrowser:ut,isIE:ct,isRtl:lt,hasTouch:pt,pointerDown:gt,pointerMove:mt,pointerUp:vt,pointerEnter:wt,pointerLeave:bt,pointerCancel:xt,on:Xt,off:Gt,once:Kt,trigger:Jt,createEvent:Zt,toEventTargets:ne,isTouch:re,getEventPos:oe,fastdom:xi,isVoidElement:Ft,isVisible:jt,selInput:Wt,isInput:Vt,filter:Rt,within:qt,parents:Ut,children:Yt,hasOwn:l,hyphenate:d,camelize:f,ucfirst:p,startsWith:w,endsWith:u,includes:b,findIndex:y,isArray:k,isFunction:$,isObject:I,isPlainObject:T,isWindow:E,isDocument:_,isJQuery:C,isNode:A,isElement:M,isNodeCollection:N,isBoolean:z,isString:D,isNumber:B,isNumeric:P,isEmpty:O,isUndefined:H,toBoolean:L,toNumber:F,toFloat:j,toNode:W,toNodes:V,toWindow:R,toList:q,toMs:U,isEqual:Y,swap:X,assign:G,last:K,each:J,sortBy:Z,uniqueBy:Q,clamp:tt,noop:et,intersectRect:it,pointInRect:nt,Dimensions:rt,MouseTracker:Ti,mergeOptions:Ai,parseOptions:Mi,Player:Ni,Promise:ae,Deferred:se,IntersectionObserver:Vi,query:yt,queryAll:kt,find:It,findAll:St,matches:zt,closest:Bt,parent:Pt,escape:Ht,css:Re,getStyles:qe,getStyle:Ue,getCssVar:Xe,propName:Ke,isInView:Bi,scrollTop:Pi,scrollIntoView:Oi,scrolledOver:Hi,scrollParents:Li,getViewport:Fi}),qi.data="__uikit__",qi.prefix="uk-",qi.options={},qi.version="3.4.5-dev.276d6479d",Xi=(Ui=qi).data,Ui.use=function(t){if(!t.installed)return t.call(null,this),t.installed=!0,this},Ui.mixin=function(t,e){(e=(D(e)?Ui.component(e):e)||this).options=Ai(e.options,t);},Ui.extend=function(t){t=t||{};function e(t){this._init(t);}return ((e.prototype=Object.create(this.prototype)).constructor=e).options=Ai(this.options,t),e.super=this,e.extend=this.extend,e},Ui.update=function(t,e){Ut(t=t?W(t):document.body).reverse().forEach(function(t){return en(t[Xi],e)}),Ae(t,function(t){return en(t[Xi],e)});},Object.defineProperty(Ui,"container",{get:function(){return Yi||document.body},set:function(t){Yi=Me(t);}}),(Gi=qi).prototype._callHook=function(t){var e=this,i=this.$options[t];i&&i.forEach(function(t){return t.call(e)});},Gi.prototype._callConnected=function(){this._connected||(this._data={},this._computeds={},this._frames={reads:{},writes:{}},this._initProps(),this._callHook("beforeConnect"),this._connected=!0,this._initEvents(),this._initObserver(),this._callHook("connected"),this._callUpdate());},Gi.prototype._callDisconnected=function(){this._connected&&(this._callHook("beforeDisconnect"),this._observer&&(this._observer.disconnect(),this._observer=null),this._unbindEvents(),this._callHook("disconnected"),this._connected=!1);},Gi.prototype._callUpdate=function(t){var o=this;void 0===t&&(t="update");var s=t.type||t;b(["update","resize"],s)&&this._callWatches();var e=this.$options.update,i=this._frames,a=i.reads,h=i.writes;e&&e.forEach(function(t,e){var i=t.read,n=t.write,r=t.events;"update"!==s&&!b(r,s)||(i&&!b(xi.reads,a[e])&&(a[e]=xi.read(function(){var t=o._connected&&i.call(o,o._data,s);!1===t&&n?xi.clear(h[e]):T(t)&&G(o._data,t);})),n&&!b(xi.writes,h[e])&&(h[e]=xi.write(function(){return o._connected&&n.call(o,o._data,s)})));});},Gi.prototype._callWatches=function(){var h=this,u=this._frames;if(!u._watch){var c=!l(u,"_watch");u._watch=xi.read(function(){if(h._connected){var t=h.$options.computed,e=h._computeds;for(var i in t){var n=l(e,i),r=e[i];delete e[i];var o=t[i],s=o.watch,a=o.immediate;s&&(c&&a||n&&!Y(r,h[i]))&&s.call(h,h[i],r);}u._watch=null;}});}},Ji=0,(Ki=qi).prototype._init=function(t){(t=t||{}).data=function(t,e){var i=t.data,n=(t.el,e.args),r=e.props;void 0===r&&(r={});if(i=k(i)?O(n)?void 0:i.slice(0,n.length).reduce(function(t,e,i){return T(e)?G(t,e):t[n[i]]=e,t},{}):i)for(var o in i)H(i[o])?delete i[o]:i[o]=r[o]?an(r[o],i[o]):i[o];return i}(t,this.constructor.options),this.$options=Ai(this.constructor.options,t,this),this.$el=null,this.$props={},this._uid=Ji++,this._initData(),this._initMethods(),this._initComputeds(),this._callHook("created"),t.el&&this.$mount(t.el);},Ki.prototype._initData=function(){var t=this.$options.data;for(var e in void 0===t&&(t={}),t)this.$props[e]=this[e]=t[e];},Ki.prototype._initMethods=function(){var t=this.$options.methods;if(t)for(var e in t)this[e]=t[e].bind(this);},Ki.prototype._initComputeds=function(){var t=this.$options.computed;if(this._computeds={},t)for(var e in t)rn(this,e,t[e]);},Ki.prototype._initProps=function(t){var e;for(e in t=t||nn(this.$options,this.$name))H(t[e])||(this.$props[e]=t[e]);var i=[this.$options.computed,this.$options.methods];for(e in this.$props)e in t&&sn(i,e)&&(this[e]=this.$props[e]);},Ki.prototype._initEvents=function(){var i=this;this._events=[];var t=this.$options.events;t&&t.forEach(function(t){if(l(t,"handler"))on(i,t);else for(var e in t)on(i,t[e],e);});},Ki.prototype._unbindEvents=function(){this._events.forEach(function(t){return t()}),delete this._events;},Ki.prototype._initObserver=function(){var n=this,t=this.$options,r=t.attrs,e=t.props,i=t.el;if(!this._observer&&e&&!1!==r){r=k(r)?r:Object.keys(e),this._observer=new MutationObserver(function(t){var i=nn(n.$options,n.$name);t.some(function(t){var e=t.attributeName.replace("data-","");return (e===n.$name?r:[f(e)]).some(function(t){return !H(i[t])&&i[t]!==n.$props[t]})})&&n.$reset();});var o=r.map(function(t){return d(t)}).concat(this.$name);this._observer.observe(i,{attributes:!0,attributeFilter:o.concat(o.map(function(t){return "data-"+t}))});}},Qi=(Zi=qi).data,tn={},Zi.component=function(s,t){var e=d(s);if(s=f(e),!t)return T(tn[s])&&(tn[s]=Zi.extend(tn[s])),tn[s];Zi[s]=function(t,i){for(var e=arguments.length,n=Array(e);e--;)n[e]=arguments[e];var r=Zi.component(s);return r.options.functional?new r({data:T(t)?t:[].concat(n)}):t?Ne(t).map(o)[0]:o(t);function o(t){var e=Zi.getComponent(t,s);if(e){if(!i)return e;e.$destroy();}return new r({el:t,data:i})}};var i=T(t)?G({},t):t.options;return i.name=s,i.install&&i.install(Zi,i,s),Zi._initialized&&!i.functional&&xi.read(function(){return Zi[s]("[uk-"+e+"],[data-uk-"+e+"]")}),tn[s]=T(t)?i:t},Zi.getComponents=function(t){return t&&t[Qi]||{}},Zi.getComponent=function(t,e){return Zi.getComponents(t)[e]},Zi.connect=function(t){if(t[Qi])for(var e in t[Qi])t[Qi][e]._callConnected();for(var i=0;i<t.attributes.length;i++){var n=Ri(t.attributes[i].name);n&&n in tn&&Zi[n](t);}},Zi.disconnect=function(t){for(var e in t[Qi])t[Qi][e]._callDisconnected();},function(n){var r=n.data;n.prototype.$create=function(t,e,i){return n[t](e,i)},n.prototype.$mount=function(t){var e=this.$options.name;t[r]||(t[r]={}),t[r][e]||((t[r][e]=this).$el=this.$options.el=this.$options.el||t,qt(t,document)&&this._callConnected());},n.prototype.$reset=function(){this._callDisconnected(),this._callConnected();},n.prototype.$destroy=function(t){void 0===t&&(t=!1);var e=this.$options,i=e.el,n=e.name;i&&this._callDisconnected(),this._callHook("destroy"),i&&i[r]&&(delete i[r][n],O(i[r])||delete i[r],t&&$e(this.$el));},n.prototype.$emit=function(t){this._callUpdate(t);},n.prototype.$update=function(t,e){void 0===t&&(t=this.$el),n.update(t,e);},n.prototype.$getComponent=n.getComponent;var e={};Object.defineProperties(n.prototype,{$container:Object.getOwnPropertyDescriptor(n,"container"),$name:{get:function(){var t=this.$options.name;return e[t]||(e[t]=n.prefix+d(t)),e[t]}}});}(qi);var hn={connected:function(){He(this.$el,this.$name)||De(this.$el,this.$name);}},un={props:{cls:Boolean,animation:"list",duration:Number,origin:String,transition:String},data:{cls:!1,animation:[!1],duration:200,origin:!1,transition:"linear",initProps:{overflow:"",height:"",paddingTop:"",paddingBottom:"",marginTop:"",marginBottom:""},hideProps:{overflow:"hidden",height:0,paddingTop:0,paddingBottom:0,marginTop:0,marginBottom:0}},computed:{hasAnimation:function(t){return !!t.animation[0]},hasTransition:function(t){var e=t.animation;return this.hasAnimation&&!0===e[0]}},methods:{toggleElement:function(t,i,n){var r=this;return ae.all(V(t).map(function(e){return new ae(function(t){return r._toggleElement(e,i,n).then(t,et)})}))},isToggled:function(t){var e=V(t||this.$el);return this.cls?He(e,this.cls.split(" ")[0]):!st(e,"hidden")},updateAria:function(t){!1===this.cls&&ot(t,"aria-hidden",!this.isToggled(t));},_toggleElement:function(t,e,i){var n=this;if(e=z(e)?e:ni.inProgress(t)?He(t,"uk-animation-leave"):Qe.inProgress(t)?"0px"===t.style.height:!this.isToggled(t),!Jt(t,"before"+(e?"show":"hide"),[this]))return ae.reject();var o,r=($(i)?i:!1!==i&&this.hasAnimation?this.hasTransition?cn(this):(o=this,function(t,e){ni.cancel(t);var i=o.animation,n=o.duration,r=o._toggle;return e?(r(t,!0),ni.in(t,i[0],n,o.origin)):ni.out(t,i[1]||i[0],n,o.origin).then(function(){return r(t,!1)})}):this._toggle)(t,e);Jt(t,e?"show":"hide",[this]);function s(){Jt(t,e?"shown":"hidden",[n]),n.$update(t);}return r?r.then(s):ae.resolve(s())},_toggle:function(t,e){var i;t&&(e=Boolean(e),this.cls?(i=b(this.cls," ")||e!==He(t,this.cls))&&Le(t,this.cls,b(this.cls," ")?void 0:e):(i=e===st(t,"hidden"))&&ot(t,"hidden",e?null:""),Ne("[autofocus]",t).some(function(t){return jt(t)?t.focus()||!0:t.blur()}),this.updateAria(t),i&&(Jt(t,"toggled",[this]),this.$update(t)));}}};function cn(t){var s=t.isToggled,a=t.duration,h=t.initProps,u=t.hideProps,c=t.transition,l=t._toggle;return function(t,e){var i=Qe.inProgress(t),n=t.hasChildNodes?j(Re(t.firstElementChild,"marginTop"))+j(Re(t.lastElementChild,"marginBottom")):0,r=jt(t)?ci(t)+(i?0:n):0;Qe.cancel(t),s(t)||l(t,!0),ci(t,""),xi.flush();var o=ci(t)+(i?0:n);return ci(t,r),(e?Qe.start(t,G({},h,{overflow:"hidden",height:o}),Math.round(a*(1-r/o)),c):Qe.start(t,u,Math.round(a*(r/o)),c).then(function(){return l(t,!1)})).then(function(){return Re(t,h)})}}var ln={mixins:[hn,un],props:{targets:String,active:null,collapsible:Boolean,multiple:Boolean,toggle:String,content:String,transition:String,offset:Number},data:{targets:"> *",active:!1,animation:[!0],collapsible:!0,multiple:!1,clsOpen:"uk-open",toggle:"> .uk-accordion-title",content:"> .uk-accordion-content",transition:"ease",offset:0},computed:{items:{get:function(t,e){return Ne(t.targets,e)},watch:function(t,e){var i=this;if(t.forEach(function(t){return dn(Me(i.content,t),!He(t,i.clsOpen))}),!e&&!He(t,this.clsOpen)){var n=!1!==this.active&&t[Number(this.active)]||!this.collapsible&&t[0];n&&this.toggle(n,!1);}},immediate:!0}},events:[{name:"click",delegate:function(){return this.targets+" "+this.$props.toggle},handler:function(t){t.preventDefault(),this.toggle(ge(Ne(this.targets+" "+this.$props.toggle,this.$el),t.current));}}],methods:{toggle:function(t,r){var o=this,e=[this.items[me(t,this.items)]],i=Rt(this.items,"."+this.clsOpen);this.multiple||b(i,e[0])||(e=e.concat(i)),(this.collapsible||Rt(e,":not(."+this.clsOpen+")").length)&&e.forEach(function(t){return o.toggleElement(t,!He(t,o.clsOpen),function(e,i){Le(e,o.clsOpen,i);var n=Me((e._wrapper?"> * ":"")+o.content,e);if(!1!==r&&o.hasTransition)return e._wrapper||(e._wrapper=Ie(n,"<div"+(i?" hidden":"")+">")),dn(n,!1),cn(o)(e._wrapper,i).then(function(){if(dn(n,!i),delete e._wrapper,Te(n),i){var t=Me(o.$props.toggle,e);Bi(t)||Oi(t,{offset:o.offset});}});dn(n,!i);})});}}};function dn(t,e){ot(t,"hidden",e?"":null);}var fn={mixins:[hn,un],args:"animation",props:{close:String},data:{animation:[!0],selClose:".uk-alert-close",duration:150,hideProps:G({opacity:0},un.data.hideProps)},events:[{name:"click",delegate:function(){return this.selClose},handler:function(t){t.preventDefault(),this.close();}}],methods:{close:function(){var t=this;this.toggleElement(this.$el).then(function(){return t.$destroy(!0)});}}},pn={args:"autoplay",props:{automute:Boolean,autoplay:Boolean},data:{automute:!1,autoplay:!0},computed:{inView:function(t){return "inview"===t.autoplay}},connected:function(){this.inView&&!st(this.$el,"preload")&&(this.$el.preload="none"),this.player=new Ni(this.$el),this.automute&&this.player.mute();},update:{read:function(){return !!this.player&&{visible:jt(this.$el)&&"hidden"!==Re(this.$el,"visibility"),inView:this.inView&&Bi(this.$el)}},write:function(t){var e=t.visible,i=t.inView;!e||this.inView&&!i?this.player.pause():(!0===this.autoplay||this.inView&&i)&&this.player.play();},events:["resize","scroll"]}},gn={mixins:[hn,pn],props:{width:Number,height:Number},data:{automute:!0},update:{read:function(){var t=this.$el,e=function(t){for(;t=Pt(t);)if("static"!==Re(t,"position"))return t}(t)||t.parentNode,i=e.offsetHeight,n=e.offsetWidth,r=rt.cover({width:this.width||t.naturalWidth||t.videoWidth||t.clientWidth,height:this.height||t.naturalHeight||t.videoHeight||t.clientHeight},{width:n+(n%2?1:0),height:i+(i%2?1:0)});return !(!r.width||!r.height)&&r},write:function(t){var e=t.height,i=t.width;Re(this.$el,{height:e,width:i});},events:["resize"]}};var mn,vn={props:{pos:String,offset:null,flip:Boolean,clsPos:String},data:{pos:"bottom-"+(lt?"right":"left"),flip:!0,offset:!1,clsPos:""},computed:{pos:function(t){var e=t.pos;return (e+(b(e,"-")?"":"-center")).split("-")},dir:function(){return this.pos[0]},align:function(){return this.pos[1]}},methods:{positionAt:function(t,e,i){var n;Pe(t,this.clsPos+"-(top|bottom|left|right)(-[a-z]+)?"),Re(t,{top:"",left:""});var r=this.offset,o=this.getAxis();P(r)||(r=(n=Me(r))?si(n)["x"===o?"left":"top"]-si(e)["x"===o?"right":"bottom"]:0);var s=oi(t,e,"x"===o?vi(this.dir)+" "+this.align:this.align+" "+vi(this.dir),"x"===o?this.dir+" "+this.align:this.align+" "+this.dir,"x"===o?""+("left"===this.dir?-r:r):" "+("top"===this.dir?-r:r),null,this.flip,i).target,a=s.x,h=s.y;this.dir="x"===o?a:h,this.align="x"===o?h:a,Le(t,this.clsPos+"-"+this.dir+"-"+this.align,!1===this.offset);},getAxis:function(){return "top"===this.dir||"bottom"===this.dir?"y":"x"}}},wn={mixins:[vn,un],args:"pos",props:{mode:"list",toggle:Boolean,boundary:Boolean,boundaryAlign:Boolean,delayShow:Number,delayHide:Number,clsDrop:String},data:{mode:["click","hover"],toggle:"- *",boundary:ut&&window,boundaryAlign:!1,delayShow:0,delayHide:800,clsDrop:!1,animation:["uk-animation-fade"],cls:"uk-open"},computed:{boundary:function(t,e){return yt(t.boundary,e)},clsDrop:function(t){return t.clsDrop||"uk-"+this.$options.name},clsPos:function(){return this.clsDrop}},created:function(){this.tracker=new Ti;},connected:function(){De(this.$el,this.clsDrop);var t=this.$props.toggle;this.toggle=t&&this.$create("toggle",yt(t,this.$el),{target:this.$el,mode:this.mode}),this.toggle||Jt(this.$el,"updatearia");},disconnected:function(){this.isActive()&&(mn=null);},events:[{name:"click",delegate:function(){return "."+this.clsDrop+"-close"},handler:function(t){t.preventDefault(),this.hide(!1);}},{name:"click",delegate:function(){return 'a[href^="#"]'},handler:function(t){var e=t.defaultPrevented,i=t.current.hash;e||!i||qt(i,this.$el)||this.hide(!1);}},{name:"beforescroll",handler:function(){this.hide(!1);}},{name:"toggle",self:!0,handler:function(t,e){t.preventDefault(),this.isToggled()?this.hide(!1):this.show(e,!1);}},{name:"toggleshow",self:!0,handler:function(t,e){t.preventDefault(),this.show(e);}},{name:"togglehide",self:!0,handler:function(t){t.preventDefault(),this.hide();}},{name:wt,filter:function(){return b(this.mode,"hover")},handler:function(t){re(t)||this.clearTimers();}},{name:bt,filter:function(){return b(this.mode,"hover")},handler:function(t){re(t)||this.hide();}},{name:"toggled",self:!0,handler:function(){this.isToggled()&&(this.clearTimers(),ni.cancel(this.$el),this.position());}},{name:"show",self:!0,handler:function(){var o=this;(mn=this).tracker.init(),Jt(this.$el,"updatearia"),Kt(this.$el,"hide",Xt(document,gt,function(t){var r=t.target;return !qt(r,o.$el)&&Kt(document,vt+" "+xt+" scroll",function(t){var e=t.defaultPrevented,i=t.type,n=t.target;e||i!==vt||r!==n||o.toggle&&qt(r,o.toggle.$el)||o.hide(!1);},!0)}),{self:!0}),Kt(this.$el,"hide",Xt(document,"keydown",function(t){27===t.keyCode&&(t.preventDefault(),o.hide(!1));}),{self:!0});}},{name:"beforehide",self:!0,handler:function(){this.clearTimers();}},{name:"hide",handler:function(t){var e=t.target;this.$el===e?(mn=this.isActive()?null:mn,Jt(this.$el,"updatearia"),this.tracker.cancel()):mn=null===mn&&qt(e,this.$el)&&this.isToggled()?this:mn;}},{name:"updatearia",self:!0,handler:function(t,e){t.preventDefault(),this.updateAria(this.$el),(e||this.toggle)&&(ot((e||this.toggle).$el,"aria-expanded",this.isToggled()),Le(this.toggle.$el,this.cls,this.isToggled()));}}],update:{write:function(){this.isToggled()&&!ni.inProgress(this.$el)&&this.position();},events:["resize"]},methods:{show:function(t,e){var i=this;if(void 0===t&&(t=this.toggle),void 0===e&&(e=!0),this.isToggled()&&t&&this.toggle&&t.$el!==this.toggle.$el&&this.hide(!1),this.toggle=t,this.clearTimers(),!this.isActive()){if(mn){if(e&&mn.isDelaying)return void(this.showTimer=setTimeout(this.show,10));for(;mn&&!qt(this.$el,mn.$el);)mn.hide(!1);}this.showTimer=setTimeout(function(){return !i.isToggled()&&i.toggleElement(i.$el,!0)},e&&this.delayShow||0);}},hide:function(t){var e=this;void 0===t&&(t=!0);function i(){return e.toggleElement(e.$el,!1,!1)}var n,r;this.clearTimers(),this.isDelaying=(n=this.$el,r=[],Ae(n,function(t){return "static"!==Re(t,"position")&&r.push(t)}),r.some(function(t){return e.tracker.movesTo(t)})),t&&this.isDelaying?this.hideTimer=setTimeout(this.hide,50):t&&this.delayHide?this.hideTimer=setTimeout(i,this.delayHide):i();},clearTimers:function(){clearTimeout(this.showTimer),clearTimeout(this.hideTimer),this.showTimer=null,this.hideTimer=null,this.isDelaying=!1;},isActive:function(){return mn===this},position:function(){Pe(this.$el,this.clsDrop+"-(stack|boundary)"),Le(this.$el,this.clsDrop+"-boundary",this.boundaryAlign);var t=si(this.boundary),e=this.boundaryAlign?t:si(this.toggle.$el);if("justify"===this.align){var i="y"===this.getAxis()?"width":"height";Re(this.$el,i,e[i]);}else this.$el.offsetWidth>Math.max(t.right-e.left,e.right-t.left)&&De(this.$el,this.clsDrop+"-stack");this.positionAt(this.$el,this.boundaryAlign?this.boundary:this.toggle.$el,this.boundary);}}};var bn={mixins:[hn],args:"target",props:{target:Boolean},data:{target:!1},computed:{input:function(t,e){return Me(Wt,e)},state:function(){return this.input.nextElementSibling},target:function(t,e){var i=t.target;return i&&(!0===i&&this.input.parentNode===e&&this.input.nextElementSibling||yt(i,e))}},update:function(){var t=this.target,e=this.input;if(t){var i,n=Vt(t)?"value":"textContent",r=t[n],o=e.files&&e.files[0]?e.files[0].name:zt(e,"select")&&(i=Ne("option",e).filter(function(t){return t.selected})[0])?i.textContent:e.value;r!==o&&(t[n]=o);}},events:[{name:"change",handler:function(){this.$update();}},{name:"reset",el:function(){return Bt(this.$el,"form")},handler:function(){this.$update();}}]},xn={update:{read:function(t){var e=Bi(this.$el);if(!e||t.isInView===e)return !1;t.isInView=e;},write:function(){this.$el.src=this.$el.src;},events:["scroll","resize"]}},yn={props:{margin:String,firstColumn:Boolean},data:{margin:"uk-margin-small-top",firstColumn:"uk-first-column"},update:{read:function(){return {columns:(t=this.$el.children,e=$n(t,"left","right"),lt?e.reverse():e),rows:kn(this.$el.children)};var t,e;},write:function(t){var i=this,n=t.columns;t.rows.forEach(function(t,e){return t.forEach(function(t){Le(t,i.margin,0!==e),Le(t,i.firstColumn,b(n[0],t));})});},events:["resize"]}};function kn(t){return $n(t,"top","bottom")}function $n(t,e,i){for(var n=[[]],r=0;r<t.length;r++){var o=t[r];if(jt(o))for(var s=In(o),a=n.length-1;0<=a;a--){var h=n[a];if(!h[0]){h.push(o);break}var u=void 0;if(u=h[0].offsetParent===o.offsetParent?In(h[0]):(s=In(o,!0),In(h[0],!0)),s[e]>=u[i]-1&&s[e]!==u[e]){n.push([o]);break}if(s[i]-1>u[e]||s[e]===u[e]){h.push(o);break}if(0===a){n.unshift([o]);break}}}return n}function In(t,e){var i;void 0===e&&(e=!1);var n=t.offsetTop,r=t.offsetLeft,o=t.offsetHeight,s=t.offsetWidth;return e&&(n=(i=ui(t))[0],r=i[1]),{top:n,left:r,bottom:n+o,right:r+s}}var Sn={extends:yn,mixins:[hn],name:"grid",props:{masonry:Boolean,parallax:Number},data:{margin:"uk-grid-margin",clsStack:"uk-grid-stack",masonry:!1,parallax:0},connected:function(){this.masonry&&De(this.$el,"uk-flex-top uk-flex-wrap-top");},update:[{write:function(t){var e=t.columns;Le(this.$el,this.clsStack,e.length<2);},events:["resize"]},{read:function(t){var e=t.columns,i=t.rows,n=Yt(this.$el);if(!n.length||!this.masonry&&!this.parallax)return !1;var r,o,s,a,h,u=n.some(Qe.inProgress),c=!1,l="",d=Math.abs(this.parallax);if(this.masonry){e=e.map(function(t){return Z(t,"offsetTop")});var f=e.map(function(t){return t.reduce(function(t,e){return t+e.offsetHeight},0)}),p=(s=n,a=this.margin,j((h=s.filter(function(t){return He(t,a)})[0])?Re(h,"marginTop"):Re(s[0],"paddingLeft"))*(i.length-1));r=e,o=i.map(function(t){return Math.max.apply(Math,t.map(function(t){return t.offsetHeight}))}),c=r.map(function(i){var n=0;return i.map(function(t,e){return n+=e?o[e-1]-i[e-1].offsetHeight:0})}),l=Math.max.apply(Math,f)+p,d=d&&f.reduce(function(t,e,i){return Math.max(t,e+p+(i%2?d:d/8)-l)},0);}return {padding:d,columns:e,translates:c,height:!u&&l}},write:function(t){var e=t.height,i=t.padding;Re(this.$el,"paddingBottom",i||""),!1!==e&&Re(this.$el,"height",e);},events:["resize"]},{read:function(t){var e=t.height;return {scrolled:!!this.parallax&&Hi(this.$el,e?e-ci(this.$el):0)*Math.abs(this.parallax)}},write:function(t){var e=t.columns,n=t.scrolled,r=t.translates;!1===n&&!r||e.forEach(function(t,i){return t.forEach(function(t,e){return Re(t,"transform",n||r?"translateY("+((r&&-r[i][e])+(n?i%2?n:n/8:0))+"px)":"")})});},events:["scroll","resize"]}]};var Tn=ct?{props:{selMinHeight:String},data:{selMinHeight:!1,forceHeight:!1},computed:{elements:function(t,e){var i=t.selMinHeight;return i?Ne(i,e):[e]}},update:[{read:function(){Re(this.elements,"height","");},order:-5,events:["resize"]},{write:function(){var i=this;this.elements.forEach(function(t){var e=j(Re(t,"minHeight"));e&&(i.forceHeight||Math.round(e+fi(t,"height","content-box"))>=t.offsetHeight)&&Re(t,"height",e);});},order:5,events:["resize"]}]}:{},En={mixins:[Tn],args:"target",props:{target:String,row:Boolean},data:{target:"> *",row:!0,forceHeight:!0},computed:{elements:function(t,e){return Ne(t.target,e)}},update:{read:function(){return {rows:(this.row?kn(this.elements):[this.elements]).map(_n)}},write:function(t){t.rows.forEach(function(t){var i=t.heights;return t.elements.forEach(function(t,e){return Re(t,"minHeight",i[e])})});},events:["resize"]}};function _n(t){var e;if(t.length<2)return {heights:[""],elements:t};var i=Cn(t),n=i.heights,r=i.max,o=t.some(function(t){return t.style.minHeight}),s=t.some(function(t,e){return !t.style.minHeight&&n[e]<r});return o&&s&&(Re(t,"minHeight",""),e=Cn(t),n=e.heights,r=e.max),{heights:n=t.map(function(t,e){return n[e]===r&&j(t.style.minHeight).toFixed(2)!==r.toFixed(2)?"":r}),elements:t}}function Cn(t){var e=t.map(function(t){return si(t).height-fi(t,"height","content-box")});return {heights:e,max:Math.max.apply(null,e)}}var An={mixins:[Tn],props:{expand:Boolean,offsetTop:Boolean,offsetBottom:Boolean,minHeight:Number},data:{expand:!1,offsetTop:!1,offsetBottom:!1,minHeight:0},update:{read:function(t){var e=t.minHeight;if(!jt(this.$el))return !1;var i="",n=fi(this.$el,"height","content-box");if(this.expand){if(this.$el.dataset.heightExpand="",Me("[data-height-expand]")!==this.$el)return !1;i=ci(window)-(Mn(document.documentElement)-Mn(this.$el))-n||"";}else {if(i="calc(100vh",this.offsetTop){var r=si(this.$el).top;i+=0<r&&r<ci(window)/2?" - "+r+"px":"";}!0===this.offsetBottom?i+=" - "+Mn(this.$el.nextElementSibling)+"px":P(this.offsetBottom)?i+=" - "+this.offsetBottom+"vh":this.offsetBottom&&u(this.offsetBottom,"px")?i+=" - "+j(this.offsetBottom)+"px":D(this.offsetBottom)&&(i+=" - "+Mn(yt(this.offsetBottom,this.$el))+"px"),i+=(n?" - "+n+"px":"")+")";}return {minHeight:i,prev:e}},write:function(t){var e=t.minHeight,i=t.prev;Re(this.$el,{minHeight:e}),e!==i&&this.$update(this.$el,"resize"),this.minHeight&&j(Re(this.$el,"minHeight"))<this.minHeight&&Re(this.$el,"minHeight",this.minHeight);},events:["resize"]}};function Mn(t){return t&&si(t).height||0}var Nn={args:"src",props:{id:Boolean,icon:String,src:String,style:String,width:Number,height:Number,ratio:Number,class:String,strokeAnimation:Boolean,focusable:Boolean,attributes:"list"},data:{ratio:1,include:["style","class","focusable"],class:"",strokeAnimation:!1},beforeConnect:function(){this.class+=" uk-svg";},connected:function(){var t,e=this;!this.icon&&b(this.src,"#")&&(t=this.src.split("#"),this.src=t[0],this.icon=t[1]),this.svg=this.getSvg().then(function(t){return e.applyAttributes(t),e.svgEl=function(t,e){if(Ft(e)||"CANVAS"===e.tagName){ot(e,"hidden",!0);var i=e.nextElementSibling;return On(t,i)?i:ye(e,t)}var n=e.lastElementChild;return On(t,n)?n:be(e,t)}(t,e.$el)},et);},disconnected:function(){var e=this;Ft(this.$el)&&ot(this.$el,"hidden",null),this.svg&&this.svg.then(function(t){return (!e._connected||t!==e.svgEl)&&$e(t)},et),this.svg=this.svgEl=null;},update:{read:function(){return !!(this.strokeAnimation&&this.svgEl&&jt(this.svgEl))},write:function(){var t,e;t=this.svgEl,(e=Pn(t))&&t.style.setProperty("--uk-animation-stroke",e);},type:["resize"]},methods:{getSvg:function(){var e=this;return function(i){if(zn[i])return zn[i];return zn[i]=new ae(function(e,t){i?w(i,"data:")?e(decodeURIComponent(i.split(",")[1])):de(i).then(function(t){return e(t.response)},function(){return t("SVG not found.")}):t();})}(this.src).then(function(t){return function(t,e){e&&b(t,"<symbol")&&(t=function(t,e){if(!Bn[t]){var i;for(Bn[t]={},Dn.lastIndex=0;i=Dn.exec(t);)Bn[t][i[3]]='<svg xmlns="http://www.w3.org/2000/svg"'+i[1]+"svg>";}return Bn[t][e]}(t,e)||t);return (t=Me(t.substr(t.indexOf("<svg"))))&&t.hasChildNodes()&&t}(t,e.icon)||ae.reject("SVG not found.")})},applyAttributes:function(i){var n=this;for(var t in this.$options.props)this[t]&&b(this.include,t)&&ot(i,t,this[t]);for(var e in this.attributes){var r=this.attributes[e].split(":",2),o=r[0],s=r[1];ot(i,o,s);}this.id||at(i,"id");var a=["width","height"],h=[this.width,this.height];h.some(function(t){return t})||(h=a.map(function(t){return ot(i,t)}));var u=ot(i,"viewBox");u&&!h.some(function(t){return t})&&(h=u.split(" ").slice(2)),h.forEach(function(t,e){(t=(0|t)*n.ratio)&&ot(i,a[e],t),t&&!h[1^e]&&at(i,a[1^e]);}),ot(i,"data-svg",this.icon||this.src);}}},zn={};var Dn=/<symbol([^]*?id=(['"])(.+?)\2[^]*?<\/)symbol>/g,Bn={};function Pn(t){return Math.ceil(Math.max.apply(Math,[0].concat(Ne("[stroke]",t).map(function(t){try{return t.getTotalLength()}catch(t){return 0}}))))}function On(t,e){return ot(t,"data-svg")===ot(e,"data-svg")}var Hn={spinner:'<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" cx="15" cy="15" r="14"/></svg>',totop:'<svg width="18" height="10" viewBox="0 0 18 10" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.2" points="1 9 9 1 17 9 "/></svg>',marker:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="4" width="1" height="11"/><rect x="4" y="9" width="11" height="1"/></svg>',"close-icon":'<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><line fill="none" stroke="#000" stroke-width="1.1" x1="1" y1="1" x2="13" y2="13"/><line fill="none" stroke="#000" stroke-width="1.1" x1="13" y1="1" x2="1" y2="13"/></svg>',"close-large":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><line fill="none" stroke="#000" stroke-width="1.4" x1="1" y1="1" x2="19" y2="19"/><line fill="none" stroke="#000" stroke-width="1.4" x1="19" y1="1" x2="1" y2="19"/></svg>',"navbar-toggle-icon":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect y="9" width="20" height="2"/><rect y="3" width="20" height="2"/><rect y="15" width="20" height="2"/></svg>',"overlay-icon":'<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="19" y="0" width="1" height="40"/><rect x="0" y="19" width="40" height="1"/></svg>',"pagination-next":'<svg width="7" height="12" viewBox="0 0 7 12" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.2" points="1 1 6 6 1 11"/></svg>',"pagination-previous":'<svg width="7" height="12" viewBox="0 0 7 12" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.2" points="6 1 1 6 6 11"/></svg>',"search-icon":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="9" cy="9" r="7"/><path fill="none" stroke="#000" stroke-width="1.1" d="M14,14 L18,18 L14,14 Z"/></svg>',"search-large":'<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.8" cx="17.5" cy="17.5" r="16.5"/><line fill="none" stroke="#000" stroke-width="1.8" x1="38" y1="39" x2="29" y2="30"/></svg>',"search-navbar":'<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="10.5" cy="10.5" r="9.5"/><line fill="none" stroke="#000" stroke-width="1.1" x1="23" y1="23" x2="17" y2="17"/></svg>',"slidenav-next":'<svg width="14px" height="24px" viewBox="0 0 14 24" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.4" points="1.225,23 12.775,12 1.225,1 "/></svg>',"slidenav-next-large":'<svg width="25px" height="40px" viewBox="0 0 25 40" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="2" points="4.002,38.547 22.527,20.024 4,1.5 "/></svg>',"slidenav-previous":'<svg width="14px" height="24px" viewBox="0 0 14 24" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.4" points="12.775,1 1.225,12 12.775,23 "/></svg>',"slidenav-previous-large":'<svg width="25px" height="40px" viewBox="0 0 25 40" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="2" points="20.527,1.5 2,20.024 20.525,38.547 "/></svg>'},Ln={install:function(r){r.icon.add=function(t,e){var i,n=D(t)?((i={})[t]=e,i):t;J(n,function(t,e){Hn[e]=t,delete qn[e];}),r._initialized&&Ae(document.body,function(t){return J(r.getComponents(t),function(t){t.$options.isIcon&&t.icon in n&&t.$reset();})});};},extends:Nn,args:"icon",props:["icon"],data:{include:["focusable"]},isIcon:!0,beforeConnect:function(){De(this.$el,"uk-icon");},methods:{getSvg:function(){var t=function(t){if(!Hn[t])return null;qn[t]||(qn[t]=Me((Hn[function(t){return lt?X(X(t,"left","right"),"previous","next"):t}(t)]||Hn[t]).trim()));return qn[t].cloneNode(!0)}(this.icon);return t?ae.resolve(t):ae.reject("Icon not found.")}}},Fn={args:!1,extends:Ln,data:function(t){return {icon:d(t.constructor.options.name)}},beforeConnect:function(){De(this.$el,this.$name);}},jn={extends:Fn,beforeConnect:function(){De(this.$el,"uk-slidenav");},computed:{icon:function(t,e){var i=t.icon;return He(e,"uk-slidenav-large")?i+"-large":i}}},Wn={extends:Fn,computed:{icon:function(t,e){var i=t.icon;return He(e,"uk-search-icon")&&Ut(e,".uk-search-large").length?"search-large":Ut(e,".uk-search-navbar").length?"search-navbar":i}}},Vn={extends:Fn,computed:{icon:function(){return "close-"+(He(this.$el,"uk-close-large")?"large":"icon")}}},Rn={extends:Fn,connected:function(){var e=this;this.svg.then(function(t){return 1!==e.ratio&&Re(Me("circle",t),"strokeWidth",1/e.ratio)},et);}},qn={};var Un={args:"dataSrc",props:{dataSrc:String,dataSrcset:Boolean,sizes:String,width:Number,height:Number,offsetTop:String,offsetLeft:String,target:String},data:{dataSrc:"",dataSrcset:!1,sizes:!1,width:!1,height:!1,offsetTop:"50vh",offsetLeft:0,target:!1},computed:{cacheKey:function(t){var e=t.dataSrc;return this.$name+"."+e},width:function(t){var e=t.width,i=t.dataWidth;return e||i},height:function(t){var e=t.height,i=t.dataHeight;return e||i},sizes:function(t){var e=t.sizes,i=t.dataSizes;return e||i},isImg:function(t,e){return Qn(e)},target:{get:function(t){var e=t.target;return [this.$el].concat(kt(e,this.$el))},watch:function(){this.observe();}},offsetTop:function(t){return wi(t.offsetTop,"height")},offsetLeft:function(t){return wi(t.offsetLeft,"width")}},connected:function(){er[this.cacheKey]?Yn(this.$el,er[this.cacheKey]||this.dataSrc,this.dataSrcset,this.sizes):this.isImg&&this.width&&this.height&&Yn(this.$el,function(t,e,i){var n;i&&(n=rt.ratio({width:t,height:e},"width",wi(Gn(i))),t=n.width,e=n.height);return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="'+t+'" height="'+e+'"></svg>'}(this.width,this.height,this.sizes)),this.observer=new Vi(this.load,{rootMargin:this.offsetTop+"px "+this.offsetLeft+"px"}),requestAnimationFrame(this.observe);},disconnected:function(){this.observer.disconnect();},update:{read:function(t){var e=this,i=t.image;if(i||"complete"!==document.readyState||this.load(this.observer.takeRecords()),this.isImg)return !1;i&&i.then(function(t){return t&&""!==t.currentSrc&&Yn(e.$el,tr(t))});},write:function(t){if(this.dataSrcset&&1!==window.devicePixelRatio){var e=Re(this.$el,"backgroundSize");!e.match(/^(auto\s?)+$/)&&j(e)!==t.bgSize||(t.bgSize=(i=this.dataSrcset,n=this.sizes,r=wi(Gn(n)),(o=(i.match(Zn)||[]).map(j).sort(function(t,e){return t-e})).filter(function(t){return r<=t})[0]||o.pop()||""),Re(this.$el,"backgroundSize",t.bgSize+"px"));}var i,n,r,o;},events:["resize"]},methods:{load:function(t){var e=this;t.some(function(t){return H(t.isIntersecting)||t.isIntersecting})&&(this._data.image=fe(this.dataSrc,this.dataSrcset,this.sizes).then(function(t){return Yn(e.$el,tr(t),t.srcset,t.sizes),er[e.cacheKey]=tr(t),t},et),this.observer.disconnect());},observe:function(){var e=this;this._connected&&!this._data.image&&this.target.forEach(function(t){return e.observer.observe(t)});}}};function Yn(t,e,i,n){if(Qn(t))n&&(t.sizes=n),i&&(t.srcset=i),e&&(t.src=e);else if(e){!b(t.style.backgroundImage,e)&&(Re(t,"backgroundImage","url("+Ht(e)+")"),Jt(t,Zt("load",!1)));}}var Xn=/\s*(.*?)\s*(\w+|calc\(.*?\))\s*(?:,|$)/g;function Gn(t){var e,i;for(Xn.lastIndex=0;e=Xn.exec(t);)if(!e[1]||window.matchMedia(e[1]).matches){e=w(i=e[2],"calc")?i.substring(5,i.length-1).replace(Kn,function(t){return wi(t)}).replace(/ /g,"").match(Jn).reduce(function(t,e){return t+ +e},0):i;break}return e||"100vw"}var Kn=/\d+(?:\w+|%)/g,Jn=/[+-]?(\d+)/g;var Zn=/\s+\d+w\s*(?:,|$)/g;function Qn(t){return "IMG"===t.tagName}function tr(t){return t.currentSrc||t.src}var er,ir="__test__";try{(er=window.sessionStorage||{})[ir]=1,delete er[ir];}catch(t){er={};}var nr={props:{media:Boolean},data:{media:!1},computed:{matchMedia:function(){var t=function(t){if(D(t)){if("@"===t[0])t=j(Xe("breakpoint-"+t.substr(1)));else if(isNaN(t))return t}return !(!t||isNaN(t))&&"(min-width: "+t+"px)"}(this.media);return !t||window.matchMedia(t).matches}}};var rr={mixins:[hn,nr],props:{fill:String},data:{fill:"",clsWrapper:"uk-leader-fill",clsHide:"uk-leader-hide",attrFill:"data-fill"},computed:{fill:function(t){return t.fill||Xe("leader-fill-content")}},connected:function(){var t;t=Se(this.$el,'<span class="'+this.clsWrapper+'">'),this.wrapper=t[0];},disconnected:function(){Te(this.wrapper.childNodes);},update:{read:function(t){var e=t.changed,i=t.width,n=i;return {width:i=Math.floor(this.$el.offsetWidth/2),fill:this.fill,changed:e||n!==i,hide:!this.matchMedia}},write:function(t){Le(this.wrapper,this.clsHide,t.hide),t.changed&&(t.changed=!1,ot(this.wrapper,this.attrFill,new Array(t.width).join(t.fill)));},events:["resize"]}},or={props:{container:Boolean},data:{container:!0},computed:{container:function(t){var e=t.container;return !0===e&&this.$container||e&&Me(e)}}},sr=[],ar={mixins:[hn,or,un],props:{selPanel:String,selClose:String,escClose:Boolean,bgClose:Boolean,stack:Boolean},data:{cls:"uk-open",escClose:!0,bgClose:!0,overlay:!0,stack:!1},computed:{panel:function(t,e){return Me(t.selPanel,e)},transitionElement:function(){return this.panel},bgClose:function(t){return t.bgClose&&this.panel}},beforeDisconnect:function(){this.isToggled()&&this.toggleElement(this.$el,!1,!1);},events:[{name:"click",delegate:function(){return this.selClose},handler:function(t){t.preventDefault(),this.hide();}},{name:"toggle",self:!0,handler:function(t){t.defaultPrevented||(t.preventDefault(),this.isToggled()===b(sr,this)&&this.toggle());}},{name:"beforeshow",self:!0,handler:function(t){if(b(sr,this))return !1;!this.stack&&sr.length?(ae.all(sr.map(function(t){return t.hide()})).then(this.show),t.preventDefault()):sr.push(this);}},{name:"show",self:!0,handler:function(){var o=this;li(window)-li(document)&&this.overlay&&Re(document.body,"overflowY","scroll"),this.stack&&Re(this.$el,"zIndex",Re(this.$el,"zIndex")+sr.length),De(document.documentElement,this.clsPage),this.bgClose&&Kt(this.$el,"hide",Xt(document,gt,function(t){var r=t.target;K(sr)!==o||o.overlay&&!qt(r,o.$el)||qt(r,o.panel)||Kt(document,vt+" "+xt+" scroll",function(t){var e=t.defaultPrevented,i=t.type,n=t.target;e||i!==vt||r!==n||o.hide();},!0);}),{self:!0}),this.escClose&&Kt(this.$el,"hide",Xt(document,"keydown",function(t){27===t.keyCode&&K(sr)===o&&(t.preventDefault(),o.hide());}),{self:!0});}},{name:"hidden",self:!0,handler:function(){var e=this;sr.splice(sr.indexOf(this),1),sr.length||Re(document.body,"overflowY",""),Re(this.$el,"zIndex",""),sr.some(function(t){return t.clsPage===e.clsPage})||Be(document.documentElement,this.clsPage);}}],methods:{toggle:function(){return this.isToggled()?this.hide():this.show()},show:function(){var e=this;return this.container&&this.$el.parentNode!==this.container?(be(this.container,this.$el),new ae(function(t){return requestAnimationFrame(function(){return e.show().then(t)})})):this.toggleElement(this.$el,!0,hr(this))},hide:function(){return this.toggleElement(this.$el,!1,hr(this))}}};function hr(t){var s=t.transitionElement,a=t._toggle;return function(r,o){return new ae(function(i,n){return Kt(r,"show hide",function(){r._reject&&r._reject(),r._reject=n,a(r,o);var t=Kt(s,"transitionstart",function(){Kt(s,"transitionend transitioncancel",i,{self:!0}),clearTimeout(e);},{self:!0}),e=setTimeout(function(){t(),i();},U(Re(s,"transitionDuration")));})})}}var ur={install:function(t){var a=t.modal;function e(t,e,i,n){e=G({bgClose:!1,escClose:!0,labels:a.labels},e);var r=a.dialog(t(e),e),o=new se,s=!1;return Xt(r.$el,"submit","form",function(t){t.preventDefault(),o.resolve(n&&n(r)),s=!0,r.hide();}),Xt(r.$el,"hide",function(){return !s&&i(o)}),o.promise.dialog=r,o.promise}a.dialog=function(t,e){var i=a('<div class="uk-modal"> <div class="uk-modal-dialog">'+t+"</div> </div>",e);return i.show(),Xt(i.$el,"hidden",function(){return ae.resolve().then(function(){return i.$destroy(!0)})},{self:!0}),i},a.alert=function(i,t){return e(function(t){var e=t.labels;return '<div class="uk-modal-body">'+(D(i)?i:we(i))+'</div> <div class="uk-modal-footer uk-text-right"> <button class="uk-button uk-button-primary uk-modal-close" autofocus>'+e.ok+"</button> </div>"},t,function(t){return t.resolve()})},a.confirm=function(i,t){return e(function(t){var e=t.labels;return '<form> <div class="uk-modal-body">'+(D(i)?i:we(i))+'</div> <div class="uk-modal-footer uk-text-right"> <button class="uk-button uk-button-default uk-modal-close" type="button">'+e.cancel+'</button> <button class="uk-button uk-button-primary" autofocus>'+e.ok+"</button> </div> </form>"},t,function(t){return t.reject()})},a.prompt=function(i,n,t){return e(function(t){var e=t.labels;return '<form class="uk-form-stacked"> <div class="uk-modal-body"> <label>'+(D(i)?i:we(i))+'</label> <input class="uk-input" value="'+(n||"")+'" autofocus> </div> <div class="uk-modal-footer uk-text-right"> <button class="uk-button uk-button-default uk-modal-close" type="button">'+e.cancel+'</button> <button class="uk-button uk-button-primary">'+e.ok+"</button> </div> </form>"},t,function(t){return t.resolve(null)},function(t){return Me("input",t.$el).value})},a.labels={ok:"Ok",cancel:"Cancel"};},mixins:[ar],data:{clsPage:"uk-modal-page",selPanel:".uk-modal-dialog",selClose:".uk-modal-close, .uk-modal-close-default, .uk-modal-close-outside, .uk-modal-close-full"},events:[{name:"show",self:!0,handler:function(){He(this.panel,"uk-margin-auto-vertical")?De(this.$el,"uk-flex"):Re(this.$el,"display","block"),ci(this.$el);}},{name:"hidden",self:!0,handler:function(){Re(this.$el,"display",""),Be(this.$el,"uk-flex");}}]};var cr={extends:ln,data:{targets:"> .uk-parent",toggle:"> a",content:"> ul"}},lr={mixins:[hn,Tn],props:{dropdown:String,mode:"list",align:String,offset:Number,boundary:Boolean,boundaryAlign:Boolean,clsDrop:String,delayShow:Number,delayHide:Number,dropbar:Boolean,dropbarMode:String,dropbarAnchor:Boolean,duration:Number},data:{dropdown:".uk-navbar-nav > li",align:lt?"right":"left",clsDrop:"uk-navbar-dropdown",mode:void 0,offset:void 0,delayShow:void 0,delayHide:void 0,boundaryAlign:void 0,flip:"x",boundary:!0,dropbar:!1,dropbarMode:"slide",dropbarAnchor:!1,duration:200,forceHeight:!0,selMinHeight:".uk-navbar-nav > li > a, .uk-navbar-item, .uk-navbar-toggle"},computed:{boundary:function(t,e){var i=t.boundary,n=t.boundaryAlign;return !0===i||n?e:i},dropbarAnchor:function(t,e){return yt(t.dropbarAnchor,e)},pos:function(t){return "bottom-"+t.align},dropbar:{get:function(t){var e=t.dropbar;return e?(e=this._dropbar||yt(e,this.$el)||Me("+ .uk-navbar-dropbar",this.$el))||(this._dropbar=Me("<div></div>")):null},watch:function(t){De(t,"uk-navbar-dropbar");},immediate:!0},dropdowns:{get:function(t,e){return Ne(t.dropdown+" ."+t.clsDrop,e)},watch:function(t){var e=this;this.$create("drop",t.filter(function(t){return !e.getDropdown(t)}),G({},this.$props,{boundary:this.boundary,pos:this.pos,offset:this.dropbar||this.offset}));},immediate:!0}},disconnected:function(){this.dropbar&&$e(this.dropbar),delete this._dropbar;},events:[{name:"mouseover",delegate:function(){return this.dropdown},handler:function(t){var e=t.current,i=this.getActive();i&&i.toggle&&!qt(i.toggle.$el,e)&&!i.tracker.movesTo(i.$el)&&i.hide(!1);}},{name:"mouseleave",el:function(){return this.dropbar},handler:function(){var t=this.getActive();t&&!this.dropdowns.some(function(t){return zt(t,":hover")})&&t.hide();}},{name:"beforeshow",capture:!0,filter:function(){return this.dropbar},handler:function(){this.dropbar.parentNode||ye(this.dropbarAnchor||this.$el,this.dropbar);}},{name:"show",capture:!0,filter:function(){return this.dropbar},handler:function(t,e){var i=e.$el,n=e.dir;Le(this.dropbar,"uk-navbar-dropbar-slide","slide"===this.dropbarMode||Ut(this.$el).some(function(t){return "static"!==Re(t,"position")})),this.clsDrop&&De(i,this.clsDrop+"-dropbar"),"bottom"===n&&this.transitionTo(i.offsetHeight+j(Re(i,"marginTop"))+j(Re(i,"marginBottom")),i);}},{name:"beforehide",filter:function(){return this.dropbar},handler:function(t,e){var i=e.$el,n=this.getActive();zt(this.dropbar,":hover")&&n&&n.$el===i&&t.preventDefault();}},{name:"hide",filter:function(){return this.dropbar},handler:function(t,e){var i=e.$el,n=this.getActive();(!n||n&&n.$el===i)&&this.transitionTo(0);}}],methods:{getActive:function(){var t=this.dropdowns.map(this.getDropdown).filter(function(t){return t&&t.isActive()})[0];return t&&b(t.mode,"hover")&&qt(t.toggle.$el,this.$el)&&t},transitionTo:function(t,e){var i=this,n=this.dropbar,r=jt(n)?ci(n):0;return Re(e=r<t&&e,"clip","rect(0,"+e.offsetWidth+"px,"+r+"px,0)"),ci(n,r),Qe.cancel([e,n]),ae.all([Qe.start(n,{height:t},this.duration),Qe.start(e,{clip:"rect(0,"+e.offsetWidth+"px,"+t+"px,0)"},this.duration)]).catch(et).then(function(){Re(e,{clip:""}),i.$update(n);})},getDropdown:function(t){return this.$getComponent(t,"drop")||this.$getComponent(t,"dropdown")}}},dr={mixins:[ar],args:"mode",props:{mode:String,flip:Boolean,overlay:Boolean},data:{mode:"slide",flip:!1,overlay:!1,clsPage:"uk-offcanvas-page",clsContainer:"uk-offcanvas-container",selPanel:".uk-offcanvas-bar",clsFlip:"uk-offcanvas-flip",clsContainerAnimation:"uk-offcanvas-container-animation",clsSidebarAnimation:"uk-offcanvas-bar-animation",clsMode:"uk-offcanvas",clsOverlay:"uk-offcanvas-overlay",selClose:".uk-offcanvas-close",container:!1},computed:{clsFlip:function(t){var e=t.flip,i=t.clsFlip;return e?i:""},clsOverlay:function(t){var e=t.overlay,i=t.clsOverlay;return e?i:""},clsMode:function(t){var e=t.mode;return t.clsMode+"-"+e},clsSidebarAnimation:function(t){var e=t.mode,i=t.clsSidebarAnimation;return "none"===e||"reveal"===e?"":i},clsContainerAnimation:function(t){var e=t.mode,i=t.clsContainerAnimation;return "push"!==e&&"reveal"!==e?"":i},transitionElement:function(t){return "reveal"===t.mode?this.panel.parentNode:this.panel}},events:[{name:"click",delegate:function(){return 'a[href^="#"]'},handler:function(t){var e=t.current.hash;!t.defaultPrevented&&e&&Me(e,document.body)&&this.hide();}},{name:"touchstart",passive:!0,el:function(){return this.panel},handler:function(t){var e=t.targetTouches;1===e.length&&(this.clientY=e[0].clientY);}},{name:"touchmove",self:!0,passive:!1,filter:function(){return this.overlay},handler:function(t){t.cancelable&&t.preventDefault();}},{name:"touchmove",passive:!1,el:function(){return this.panel},handler:function(t){if(1===t.targetTouches.length){var e=event.targetTouches[0].clientY-this.clientY,i=this.panel,n=i.scrollTop,r=i.scrollHeight,o=i.clientHeight;(r<=o||0===n&&0<e||r-n<=o&&e<0)&&t.cancelable&&t.preventDefault();}}},{name:"show",self:!0,handler:function(){"reveal"!==this.mode||He(this.panel.parentNode,this.clsMode)||(Ie(this.panel,"<div>"),De(this.panel.parentNode,this.clsMode)),Re(document.documentElement,"overflowY",this.overlay?"hidden":""),De(document.body,this.clsContainer,this.clsFlip),Re(document.body,"touch-action","pan-y pinch-zoom"),Re(this.$el,"display","block"),De(this.$el,this.clsOverlay),De(this.panel,this.clsSidebarAnimation,"reveal"!==this.mode?this.clsMode:""),ci(document.body),De(document.body,this.clsContainerAnimation),this.clsContainerAnimation&&(fr().content+=",user-scalable=0");}},{name:"hide",self:!0,handler:function(){Be(document.body,this.clsContainerAnimation),Re(document.body,"touch-action","");}},{name:"hidden",self:!0,handler:function(){var t;this.clsContainerAnimation&&((t=fr()).content=t.content.replace(/,user-scalable=0$/,"")),"reveal"===this.mode&&Te(this.panel),Be(this.panel,this.clsSidebarAnimation,this.clsMode),Be(this.$el,this.clsOverlay),Re(this.$el,"display",""),Be(document.body,this.clsContainer,this.clsFlip),Re(document.documentElement,"overflowY","");}},{name:"swipeLeft swipeRight",handler:function(t){this.isToggled()&&u(t.type,"Left")^this.flip&&this.hide();}}]};function fr(){return Me('meta[name="viewport"]',document.head)||be(document.head,'<meta name="viewport">')}var pr={mixins:[hn],props:{selContainer:String,selContent:String},data:{selContainer:".uk-modal",selContent:".uk-modal-dialog"},computed:{container:function(t,e){return Bt(e,t.selContainer)},content:function(t,e){return Bt(e,t.selContent)}},connected:function(){Re(this.$el,"minHeight",150);},update:{read:function(){return !(!this.content||!this.container)&&{current:j(Re(this.$el,"maxHeight")),max:Math.max(150,ci(this.container)-(si(this.content).height-ci(this.$el)))}},write:function(t){var e=t.current,i=t.max;Re(this.$el,"maxHeight",i),Math.round(e)!==Math.round(i)&&Jt(this.$el,"resize");},events:["resize"]}},gr={props:["width","height"],connected:function(){De(this.$el,"uk-responsive-width");},update:{read:function(){return !!(jt(this.$el)&&this.width&&this.height)&&{width:li(this.$el.parentNode),height:this.height}},write:function(t){ci(this.$el,rt.contain({height:this.height,width:this.width},t).height);},events:["resize"]}},mr={props:{offset:Number},data:{offset:0},methods:{scrollTo:function(t){var e=this;t=t&&Me(t)||document.body,Jt(this.$el,"beforescroll",[this,t])&&Oi(t,{offset:this.offset}).then(function(){return Jt(e.$el,"scrolled",[e,t])});}},events:{click:function(t){t.defaultPrevented||(t.preventDefault(),this.scrollTo(Ht(decodeURIComponent(this.$el.hash)).substr(1)));}}},vr={args:"cls",props:{cls:String,target:String,hidden:Boolean,offsetTop:Number,offsetLeft:Number,repeat:Boolean,delay:Number},data:function(){return {cls:!1,target:!1,hidden:!0,offsetTop:0,offsetLeft:0,repeat:!1,delay:0,inViewClass:"uk-scrollspy-inview"}},computed:{elements:{get:function(t,e){var i=t.target;return i?Ne(i,e):[e]},watch:function(t){this.hidden&&Re(Rt(t,":not(."+this.inViewClass+")"),"visibility","hidden");},immediate:!0}},update:[{read:function(t){var i=this;t.update&&this.elements.forEach(function(t){var e=t._ukScrollspyState;(e=e||{cls:ht(t,"uk-scrollspy-class")||i.cls}).show=Bi(t,i.offsetTop,i.offsetLeft),t._ukScrollspyState=e;});},write:function(n){var r=this;if(!n.update)return this.$emit(),n.update=!0;this.elements.forEach(function(e){function t(t){Re(e,"visibility",!t&&r.hidden?"hidden":""),Le(e,r.inViewClass,t),Le(e,i.cls),Jt(e,t?"inview":"outview"),i.inview=t,r.$update(e);}var i=e._ukScrollspyState;!i.show||i.inview||i.queued?!i.show&&i.inview&&!i.queued&&r.repeat&&t(!1):(i.queued=!0,n.promise=(n.promise||ae.resolve()).then(function(){return new ae(function(t){return setTimeout(t,r.delay)})}).then(function(){t(!0),setTimeout(function(){i.queued=!1,r.$emit();},300);}));});},events:["scroll","resize"]}]},wr={props:{cls:String,closest:String,scroll:Boolean,overflow:Boolean,offset:Number},data:{cls:"uk-active",closest:!1,scroll:!1,overflow:!0,offset:0},computed:{links:{get:function(t,e){return Ne('a[href^="#"]',e).filter(function(t){return t.hash})},watch:function(t){this.scroll&&this.$create("scroll",t,{offset:this.offset||0});},immediate:!0},targets:function(){return Ne(this.links.map(function(t){return Ht(t.hash).substr(1)}).join(","))},elements:function(t){var e=t.closest;return Bt(this.links,e||"*")}},update:[{read:function(){var i=this,t=this.targets.length;if(!t||!jt(this.$el))return !1;var e=K(Li(this.targets[0])),n=e.scrollTop,r=e.scrollHeight,o=Fi(e),s=r-si(o).height,a=!1;return n===s?a=t-1:(this.targets.every(function(t,e){if(hi(t,o).top-i.offset<=0)return a=e,!0}),!1===a&&this.overflow&&(a=0)),{active:a}},write:function(t){var e=t.active;this.links.forEach(function(t){return t.blur()}),Be(this.elements,this.cls),!1!==e&&Jt(this.$el,"active",[e,De(this.elements[e],this.cls)]);},events:["scroll","resize"]}]},br={mixins:[hn,nr],props:{top:null,bottom:Boolean,offset:String,animation:String,clsActive:String,clsInactive:String,clsFixed:String,clsBelow:String,selTarget:String,widthElement:Boolean,showOnUp:Boolean,targetOffset:Number},data:{top:0,bottom:!1,offset:0,animation:"",clsActive:"uk-active",clsInactive:"",clsFixed:"uk-sticky-fixed",clsBelow:"uk-sticky-below",selTarget:"",widthElement:!1,showOnUp:!1,targetOffset:!1},computed:{offset:function(t){return wi(t.offset)},selTarget:function(t,e){var i=t.selTarget;return i&&Me(i,e)||e},widthElement:function(t,e){return yt(t.widthElement,e)||this.placeholder},isActive:{get:function(){return He(this.selTarget,this.clsActive)},set:function(t){t&&!this.isActive?(Oe(this.selTarget,this.clsInactive,this.clsActive),Jt(this.$el,"active")):t||He(this.selTarget,this.clsInactive)||(Oe(this.selTarget,this.clsActive,this.clsInactive),Jt(this.$el,"inactive"));}}},connected:function(){this.placeholder=Me("+ .uk-sticky-placeholder",this.$el)||Me('<div class="uk-sticky-placeholder"></div>'),this.isFixed=!1,this.isActive=!1;},disconnected:function(){this.isFixed&&(this.hide(),Be(this.selTarget,this.clsInactive)),$e(this.placeholder),this.placeholder=null,this.widthElement=null;},events:[{name:"load hashchange popstate",el:ut&&window,handler:function(){var n=this;if(!1!==this.targetOffset&&location.hash&&0<window.pageYOffset){var r=Me(location.hash);r&&xi.read(function(){var t=si(r).top,e=si(n.$el).top,i=n.$el.offsetHeight;n.isFixed&&t<=e+i&&e<=t+r.offsetHeight&&Pi(window,t-i-(P(n.targetOffset)?n.targetOffset:0)-n.offset);});}}}],update:[{read:function(t,e){var i=t.height;this.isActive&&"update"!==e&&(this.hide(),i=this.$el.offsetHeight,this.show()),i=this.isActive?i:this.$el.offsetHeight,this.topOffset=si(this.isFixed?this.placeholder:this.$el).top,this.bottomOffset=this.topOffset+i;var n=xr("bottom",this);return this.top=Math.max(j(xr("top",this)),this.topOffset)-this.offset,this.bottom=n&&n-this.$el.offsetHeight,this.inactive=!this.matchMedia,{lastScroll:!1,height:i,margins:Re(this.$el,["marginTop","marginBottom","marginLeft","marginRight"])}},write:function(t){var e=t.height,i=t.margins,n=this.placeholder;Re(n,G({height:e},i)),qt(n,document)||(ye(this.$el,n),ot(n,"hidden","")),this.isActive=this.isActive;},events:["resize"]},{read:function(t){var e=t.scroll;return void 0===e&&(e=0),this.width=si(jt(this.widthElement)?this.widthElement:this.$el).width,this.scroll=window.pageYOffset,{dir:e<=this.scroll?"down":"up",scroll:this.scroll,visible:jt(this.$el),top:ui(this.placeholder)[0]}},write:function(t,e){var i=this,n=t.initTimestamp;void 0===n&&(n=0);var r=t.dir,o=t.lastDir,s=t.lastScroll,a=t.scroll,h=t.top,u=t.visible,c=performance.now();if(!((t.lastScroll=a)<0||a===s||!u||this.disabled||this.showOnUp&&"scroll"!==e||((300<c-n||r!==o)&&(t.initScroll=a,t.initTimestamp=c),t.lastDir=r,this.showOnUp&&!this.isFixed&&Math.abs(t.initScroll-a)<=30&&Math.abs(s-a)<=10)))if(this.inactive||a<this.top||this.showOnUp&&(a<=this.top||"down"===r||"up"===r&&!this.isFixed&&a<=this.bottomOffset)){if(!this.isFixed)return void(ni.inProgress(this.$el)&&a<h&&(ni.cancel(this.$el),this.hide()));this.isFixed=!1,this.animation&&a>this.topOffset?(ni.cancel(this.$el),ni.out(this.$el,this.animation).then(function(){return i.hide()},et)):this.hide();}else this.isFixed?this.update():this.animation?(ni.cancel(this.$el),this.show(),ni.in(this.$el,this.animation).catch(et)):this.show();},events:["resize","scroll"]}],methods:{show:function(){this.isFixed=!0,this.update(),ot(this.placeholder,"hidden",null);},hide:function(){this.isActive=!1,Be(this.$el,this.clsFixed,this.clsBelow),Re(this.$el,{position:"",top:"",width:""}),ot(this.placeholder,"hidden","");},update:function(){var t=0!==this.top||this.scroll>this.top,e=Math.max(0,this.offset);P(this.bottom)&&this.scroll>this.bottom-this.offset&&(e=this.bottom-this.scroll),Re(this.$el,{position:"fixed",top:e+"px",width:this.width}),this.isActive=t,Le(this.$el,this.clsBelow,this.scroll>this.bottomOffset),De(this.$el,this.clsFixed);}}};function xr(t,e){var i=e.$props,n=e.$el,r=e[t+"Offset"],o=i[t];if(o)return D(o)&&o.match(/^-?\d/)?r+wi(o):si(!0===o?n.parentNode:yt(o,n)).bottom}var yr,kr,$r,Ir={mixins:[un],args:"connect",props:{connect:String,toggle:String,active:Number,swiping:Boolean},data:{connect:"~.uk-switcher",toggle:"> * > :first-child",active:0,swiping:!0,cls:"uk-active",clsContainer:"uk-switcher",attrItem:"uk-switcher-item"},computed:{connects:{get:function(t,e){return kt(t.connect,e)},watch:function(t){var e=this;t.forEach(function(t){return e.updateAria(t.children)}),this.swiping&&Re(t,"touch-action","pan-y pinch-zoom");},immediate:!0},toggles:{get:function(t,e){return Ne(t.toggle,e).filter(function(t){return !zt(t,".uk-disabled *, .uk-disabled, [disabled]")})},watch:function(t){var e=this.index();this.show(~e&&e||t[this.active]||t[0]);},immediate:!0}},events:[{name:"click",delegate:function(){return this.toggle},handler:function(t){b(this.toggles,t.current)&&(t.preventDefault(),this.show(t.current));}},{name:"click",el:function(){return this.connects},delegate:function(){return "["+this.attrItem+"],[data-"+this.attrItem+"]"},handler:function(t){t.preventDefault(),this.show(ht(t.current,this.attrItem));}},{name:"swipeRight swipeLeft",filter:function(){return this.swiping},el:function(){return this.connects},handler:function(t){var e=t.type;this.show(u(e,"Left")?"next":"previous");}}],methods:{index:function(){var e=this;return ge(this.toggles,this.toggles.filter(function(t){return qt(t,"."+e.cls)}))},show:function(t){var i=this,n=this.index(),r=me(t,this.toggles,n);this.toggles.forEach(function(e,t){Le(Yt(i.$el).filter(function(t){return qt(e,t)}),i.cls,r===t),ot(e,"aria-expanded",r===t);}),this.connects.forEach(function(t){var e=t.children;return i.toggleElement(V(e).filter(function(t,e){return e!==r&&i.isToggled(t)}),!1,0<=n).then(function(){return i.toggleElement(e[r],!0,0<=n)})});}}},Sr={mixins:[hn],extends:Ir,props:{media:Boolean},data:{media:960,attrItem:"uk-tab-item"},connected:function(){var t=He(this.$el,"uk-tab-left")?"uk-tab-left":!!He(this.$el,"uk-tab-right")&&"uk-tab-right";t&&this.$create("toggle",this.$el,{cls:t,mode:"media",media:this.media});}},Tr={mixins:[nr,un],args:"target",props:{href:String,target:null,mode:"list",queued:Boolean},data:{href:!1,target:!1,mode:"click",queued:!0},computed:{target:{get:function(t,e){var i=t.href,n=t.target;return (n=kt(n||i,e)).length&&n||[e]},watch:function(){Jt(this.target,"updatearia",[this]);},immediate:!0}},events:[{name:wt+" "+bt,filter:function(){return b(this.mode,"hover")},handler:function(t){re(t)||this.toggle("toggle"+(t.type===wt?"show":"hide"));}},{name:"click",filter:function(){return b(this.mode,"click")||pt&&b(this.mode,"hover")},handler:function(t){var e;(Bt(t.target,'a[href="#"], a[href=""]')||(e=Bt(t.target,"a[href]"))&&(this.cls&&!He(this.target,this.cls.split(" ")[0])||!jt(this.target)||e.hash&&zt(this.target,e.hash)))&&t.preventDefault(),this.toggle();}}],update:{read:function(){return !(!b(this.mode,"media")||!this.media)&&{match:this.matchMedia}},write:function(t){var e=t.match,i=this.isToggled(this.target);(e?!i:i)&&this.toggle();},events:["resize"]},methods:{toggle:function(t){var e=this;if(Jt(this.target,t||"toggle",[this]))if(this.queued){var i=this.target.filter(this.isToggled);this.toggleElement(i,!1).then(function(){return e.toggleElement(e.target.filter(function(t){return !b(i,t)}),!0)});}else this.toggleElement(this.target);}}};J(Object.freeze({__proto__:null,Accordion:ln,Alert:fn,Cover:gn,Drop:wn,Dropdown:wn,FormCustom:bn,Gif:xn,Grid:Sn,HeightMatch:En,HeightViewport:An,Icon:Ln,Img:Un,Leader:rr,Margin:yn,Modal:ur,Nav:cr,Navbar:lr,Offcanvas:dr,OverflowAuto:pr,Responsive:gr,Scroll:mr,Scrollspy:vr,ScrollspyNav:wr,Sticky:br,Svg:Nn,Switcher:Ir,Tab:Sr,Toggle:Tr,Video:pn,Close:Vn,Spinner:Rn,SlidenavNext:jn,SlidenavPrevious:jn,SearchIcon:Wn,Marker:Fn,NavbarToggleIcon:Fn,OverlayIcon:Fn,PaginationNext:Fn,PaginationPrevious:Fn,Totop:Fn}),function(t,e){return qi.component(e,t)}),qi.use(function(r){ut&&pe(function(){var e;r.update(),Xt(window,"load resize",function(){return r.update(null,"resize")}),Xt(document,"loadedmetadata load",function(t){var e=t.target;return r.update(e,"resize")},!0),Xt(window,"scroll",function(t){e||(e=!0,xi.write(function(){return e=!1}),r.update(null,t.type));},{passive:!0,capture:!0});var i,n=0;Xt(document,"animationstart",function(t){var e=t.target;(Re(e,"animationName")||"").match(/^uk-.*(left|right)/)&&(n++,Re(document.body,"overflowX","hidden"),setTimeout(function(){--n||Re(document.body,"overflowX","");},U(Re(e,"animationDuration"))+100));},!0),Xt(document,gt,function(t){if(i&&i(),re(t)){var s=oe(t),a="tagName"in t.target?t.target:t.target.parentNode;i=Kt(document,vt+" "+xt,function(t){var e=oe(t),r=e.x,o=e.y;(a&&r&&100<Math.abs(s.x-r)||o&&100<Math.abs(s.y-o))&&setTimeout(function(){var t,e,i,n;Jt(a,"swipe"),Jt(a,"swipe"+(t=s.x,e=s.y,i=r,n=o,Math.abs(t-i)>=Math.abs(e-n)?0<t-i?"Left":"Right":0<e-n?"Up":"Down"));});});}},{passive:!0});});}),kr=(yr=qi).connect,$r=yr.disconnect,ut&&window.MutationObserver&&xi.read(function(){document.body&&Ae(document.body,kr);new MutationObserver(function(t){var r=[];t.forEach(function(t){return i=r,n=(e=t).target,void(("attributes"!==e.type?function(t){for(var e=t.addedNodes,i=t.removedNodes,n=0;n<e.length;n++)Ae(e[n],kr);for(var r=0;r<i.length;r++)Ae(i[r],$r);return !0}:function(t){var e=t.target,i=t.attributeName;if("href"===i)return !0;var n=Ri(i);if(!(n&&n in yr))return;if(st(e,i))return yr[n](e),!0;var r=yr.getComponent(e,n);if(r)return r.$destroy(),!0})(e)&&!i.some(function(t){return t.contains(n)})&&i.push(n.contains?n:n.parentNode));var e,i,n;}),r.forEach(function(t){return yr.update(t)});}).observe(document,{childList:!0,subtree:!0,characterData:!0,attributes:!0}),yr._initialized=!0;});var Er={mixins:[hn],props:{date:String,clsWrapper:String},data:{date:"",clsWrapper:".uk-countdown-%unit%"},computed:{date:function(t){var e=t.date;return Date.parse(e)},days:function(t,e){return Me(t.clsWrapper.replace("%unit%","days"),e)},hours:function(t,e){return Me(t.clsWrapper.replace("%unit%","hours"),e)},minutes:function(t,e){return Me(t.clsWrapper.replace("%unit%","minutes"),e)},seconds:function(t,e){return Me(t.clsWrapper.replace("%unit%","seconds"),e)},units:function(){var e=this;return ["days","hours","minutes","seconds"].filter(function(t){return e[t]})}},connected:function(){this.start();},disconnected:function(){var e=this;this.stop(),this.units.forEach(function(t){return ve(e[t])});},events:[{name:"visibilitychange",el:ut&&document,handler:function(){document.hidden?this.stop():this.start();}}],update:{write:function(){var t,e,n=this,r=(t=this.date,{total:e=t-Date.now(),seconds:e/1e3%60,minutes:e/1e3/60%60,hours:e/1e3/60/60%24,days:e/1e3/60/60/24});r.total<=0&&(this.stop(),r.days=r.hours=r.minutes=r.seconds=0),this.units.forEach(function(t){var e=String(Math.floor(r[t]));e=e.length<2?"0"+e:e;var i=n[t];i.textContent!==e&&((e=e.split("")).length!==i.children.length&&we(i,e.map(function(){return "<span></span>"}).join("")),e.forEach(function(t,e){return i.children[e].textContent=t}));});}},methods:{start:function(){this.stop(),this.date&&this.units.length&&(this.$update(),this.timer=setInterval(this.$update,1e3));},stop:function(){this.timer&&(clearInterval(this.timer),this.timer=null);}}};var _r,Cr="uk-animation-target",Ar={props:{animation:Number},data:{animation:150},computed:{target:function(){return this.$el}},methods:{animate:function(t){var n=this;!function(){if(_r)return;(_r=be(document.head,"<style>").sheet).insertRule("."+Cr+" > * {\n            margin-top: 0 !important;\n            transform: none !important;\n        }",0);}();var r=Yt(this.target),o=r.map(function(t){return Mr(t,!0)}),e=ci(this.target),i=window.pageYOffset;t(),Qe.cancel(this.target),r.forEach(Qe.cancel),Nr(this.target),this.$update(this.target,"resize"),xi.flush();var s=ci(this.target),a=(r=r.concat(Yt(this.target).filter(function(t){return !b(r,t)}))).map(function(t,e){return !!(t.parentNode&&e in o)&&(o[e]?jt(t)?zr(t):{opacity:0}:{opacity:jt(t)?1:0})});return o=a.map(function(t,e){var i=r[e].parentNode===n.target&&(o[e]||Mr(r[e]));if(i)if(t){if(!("opacity"in t)){i.opacity%1?t.opacity=1:delete i.opacity;}}else delete i.opacity;return i}),De(this.target,Cr),r.forEach(function(t,e){return o[e]&&Re(t,o[e])}),Re(this.target,{height:e,display:"block"}),Pi(window,i),ae.all(r.map(function(t,e){return ["top","left","height","width"].some(function(t){return o[e][t]!==a[e][t]})&&Qe.start(t,a[e],n.animation,"ease")}).concat(e!==s&&Qe.start(this.target,{height:s},this.animation,"ease"))).then(function(){r.forEach(function(t,e){return Re(t,{display:0===a[e].opacity?"none":"",zIndex:""})}),Nr(n.target),n.$update(n.target,"resize"),xi.flush();},et)}}};function Mr(t,e){var i=Re(t,"zIndex");return !!jt(t)&&G({display:"",opacity:e?Re(t,"opacity"):"0",pointerEvents:"none",position:"absolute",zIndex:"auto"===i?ge(t):i},zr(t))}function Nr(t){Re(t.children,{height:"",left:"",opacity:"",pointerEvents:"",position:"",top:"",width:""}),Be(t,Cr),Re(t,{height:"",display:""});}function zr(t){var e=si(t),i=e.height,n=e.width,r=hi(t);return {top:r.top,left:r.left,height:i,width:n}}var Dr={mixins:[Ar],args:"target",props:{target:Boolean,selActive:Boolean},data:{target:null,selActive:!1,attrItem:"uk-filter-control",cls:"uk-active",animation:250},computed:{toggles:{get:function(t,e){t.attrItem;return Ne("["+this.attrItem+"],[data-"+this.attrItem+"]",e)},watch:function(){var e=this;if(this.updateState(),!1!==this.selActive){var i=Ne(this.selActive,this.$el);this.toggles.forEach(function(t){return Le(t,e.cls,b(i,t))});}},immediate:!0},target:function(t,e){return Me(t.target,e)},children:{get:function(){return Yt(this.target)},watch:function(t,e){var i,n;n=e,(i=t).length===n.length&&i.every(function(t){return ~n.indexOf(t)})||this.updateState();}}},events:[{name:"click",delegate:function(){return "["+this.attrItem+"],[data-"+this.attrItem+"]"},handler:function(t){t.preventDefault(),this.apply(t.current);}}],methods:{apply:function(t){this.setState(Pr(t,this.attrItem,this.getState()));},getState:function(){var i=this;return this.toggles.filter(function(t){return He(t,i.cls)}).reduce(function(t,e){return Pr(e,i.attrItem,t)},{filter:{"":""},sort:[]})},setState:function(u,t){var c=this;void 0===t&&(t=!0),u=G({filter:{"":""},sort:[]},u),Jt(this.$el,"beforeFilter",[this,u]);var l=this.children;this.toggles.forEach(function(t){return Le(t,c.cls,!!function(t,e,i){var n=i.filter;void 0===n&&(n={"":""});var r=i.sort,o=r[0],s=r[1],a=Br(t,e),h=a.filter;void 0===h&&(h="");var u=a.group;void 0===u&&(u="");var c=a.sort,l=a.order;void 0===l&&(l="asc");return H(c)?u in n&&h===n[u]||!h&&u&&!(u in n)&&!n[""]:o===c&&s===l}(t,c.attrItem,u))});function e(){var t,e,i=(t=u.filter,e="",J(t,function(t){return e+=t||""}),e);l.forEach(function(t){return Re(t,"display",i&&!zt(t,i)?"none":"")});var n,r,o=u.sort,s=o[0],a=o[1];if(s){var h=(n=s,r=a,G([],l).sort(function(t,e){return ht(t,n).localeCompare(ht(e,n),void 0,{numeric:!0})*("asc"===r||-1)}));Y(h,l)||h.forEach(function(t){return be(c.target,t)});}}t?this.animate(e).then(function(){return Jt(c.$el,"afterFilter",[c])}):(e(),Jt(this.$el,"afterFilter",[this]));},updateState:function(){var t=this;xi.write(function(){return t.setState(t.getState(),!1)});}}};function Br(t,e){return Mi(ht(t,e),["filter"])}function Pr(t,e,i){var n=Br(t,e),r=n.filter,o=n.group,s=n.sort,a=n.order;return void 0===a&&(a="asc"),(r||H(s))&&(o?r?(delete i.filter[""],i.filter[o]=r):(delete i.filter[o],(O(i.filter)||""in i.filter)&&(i.filter={"":r||""})):i.filter={"":r||""}),H(s)||(i.sort=[s,a]),i}var Or={slide:{show:function(t){return [{transform:Lr(-100*t)},{transform:Lr()}]},percent:function(t){return Hr(t)},translate:function(t,e){return [{transform:Lr(-100*e*t)},{transform:Lr(100*e*(1-t))}]}}};function Hr(t){return Math.abs(Re(t,"transform").split(",")[4]/t.offsetWidth)||0}function Lr(t,e){return void 0===t&&(t=0),void 0===e&&(e="%"),t+=t?e:"",ct?"translateX("+t+")":"translate3d("+t+", 0, 0)"}function Fr(t){return "scale3d("+t+", "+t+", 1)"}var jr=G({},Or,{fade:{show:function(){return [{opacity:0},{opacity:1}]},percent:function(t){return 1-Re(t,"opacity")},translate:function(t){return [{opacity:1-t},{opacity:t}]}},scale:{show:function(){return [{opacity:0,transform:Fr(.8)},{opacity:1,transform:Fr(1)}]},percent:function(t){return 1-Re(t,"opacity")},translate:function(t){return [{opacity:1-t,transform:Fr(1-.2*t)},{opacity:t,transform:Fr(.8+.2*t)}]}}});function Wr(t,e,i){Jt(t,Zt(e,!1,!1,i));}var Vr={mixins:[{props:{autoplay:Boolean,autoplayInterval:Number,pauseOnHover:Boolean},data:{autoplay:!1,autoplayInterval:7e3,pauseOnHover:!0},connected:function(){this.autoplay&&this.startAutoplay();},disconnected:function(){this.stopAutoplay();},update:function(){ot(this.slides,"tabindex","-1");},events:[{name:"visibilitychange",el:ut&&document,filter:function(){return this.autoplay},handler:function(){document.hidden?this.stopAutoplay():this.startAutoplay();}}],methods:{startAutoplay:function(){var t=this;this.stopAutoplay(),this.interval=setInterval(function(){return (!t.draggable||!Me(":focus",t.$el))&&(!t.pauseOnHover||!zt(t.$el,":hover"))&&!t.stack.length&&t.show("next")},this.autoplayInterval);},stopAutoplay:function(){this.interval&&clearInterval(this.interval);}}},{props:{draggable:Boolean},data:{draggable:!0,threshold:10},created:function(){var n=this;["start","move","end"].forEach(function(t){var i=n[t];n[t]=function(t){var e=oe(t).x*(lt?-1:1);n.prevPos=e!==n.pos?n.pos:n.prevPos,n.pos=e,i(t);};});},events:[{name:gt,delegate:function(){return this.selSlides},handler:function(t){var e;!this.draggable||!re(t)&&(!(e=t.target).children.length&&e.childNodes.length)||Bt(t.target,Wt)||0<t.button||this.length<2||this.start(t);}},{name:"touchmove",passive:!1,handler:"move",filter:function(){return "touchmove"==mt},delegate:function(){return this.selSlides}},{name:"dragstart",handler:function(t){t.preventDefault();}}],methods:{start:function(){var t=this;this.drag=this.pos,this._transitioner?(this.percent=this._transitioner.percent(),this.drag+=this._transitioner.getDistance()*this.percent*this.dir,this._transitioner.cancel(),this._transitioner.translate(this.percent),this.dragging=!0,this.stack=[]):this.prevIndex=this.index;var e="touchmove"!=mt?Xt(document,mt,this.move,{passive:!1}):et;this.unbindMove=function(){e(),t.unbindMove=null;},Xt(window,"scroll",this.unbindMove),Xt(window.visualViewport,"resize",this.unbindMove),Xt(document,vt+" "+xt,this.end,!0),Re(this.list,"userSelect","none");},move:function(t){var e=this;if(this.unbindMove){var i=this.pos-this.drag;if(!(0==i||this.prevPos===this.pos||!this.dragging&&Math.abs(i)<this.threshold)){Re(this.list,"pointerEvents","none"),t.cancelable&&t.preventDefault(),this.dragging=!0,this.dir=i<0?1:-1;for(var n=this.slides,r=this.prevIndex,o=Math.abs(i),s=this.getIndex(r+this.dir,r),a=this._getDistance(r,s)||n[r].offsetWidth;s!==r&&a<o;)this.drag-=a*this.dir,r=s,o-=a,s=this.getIndex(r+this.dir,r),a=this._getDistance(r,s)||n[r].offsetWidth;this.percent=o/a;var h,u=n[r],c=n[s],l=this.index!==s,d=r===s;[this.index,this.prevIndex].filter(function(t){return !b([s,r],t)}).forEach(function(t){Jt(n[t],"itemhidden",[e]),d&&(h=!0,e.prevIndex=r);}),(this.index===r&&this.prevIndex!==r||h)&&Jt(n[this.index],"itemshown",[this]),l&&(this.prevIndex=r,this.index=s,d||Jt(u,"beforeitemhide",[this]),Jt(c,"beforeitemshow",[this])),this._transitioner=this._translate(Math.abs(this.percent),u,!d&&c),l&&(d||Jt(u,"itemhide",[this]),Jt(c,"itemshow",[this]));}}},end:function(){if(Gt(window,"scroll",this.unbindMove),Gt(window.visualViewport,"resize",this.unbindMove),this.unbindMove&&this.unbindMove(),Gt(document,vt,this.end,!0),this.dragging)if(this.dragging=null,this.index===this.prevIndex)this.percent=1-this.percent,this.dir*=-1,this._show(!1,this.index,!0),this._transitioner=null;else {var t=(lt?this.dir*(lt?1:-1):this.dir)<0==this.prevPos>this.pos;this.index=t?this.index:this.prevIndex,t&&(this.percent=1-this.percent),this.show(0<this.dir&&!t||this.dir<0&&t?"next":"previous",!0);}Re(this.list,{userSelect:"",pointerEvents:""}),this.drag=this.percent=null;}}},{data:{selNav:!1},computed:{nav:function(t,e){return Me(t.selNav,e)},selNavItem:function(t){var e=t.attrItem;return "["+e+"],[data-"+e+"]"},navItems:function(t,e){return Ne(this.selNavItem,e)}},update:{write:function(){var i=this;this.nav&&this.length!==this.nav.children.length&&we(this.nav,this.slides.map(function(t,e){return "<li "+i.attrItem+'="'+e+'"><a href></a></li>'}).join("")),Le(Ne(this.selNavItem,this.$el).concat(this.nav),"uk-hidden",!this.maxIndex),this.updateNav();},events:["resize"]},events:[{name:"click",delegate:function(){return this.selNavItem},handler:function(t){t.preventDefault(),this.show(ht(t.current,this.attrItem));}},{name:"itemshow",handler:"updateNav"}],methods:{updateNav:function(){var i=this,n=this.getValidIndex();this.navItems.forEach(function(t){var e=ht(t,i.attrItem);Le(t,i.clsActive,F(e)===n),Le(t,"uk-invisible",i.finite&&("previous"===e&&0===n||"next"===e&&n>=i.maxIndex));});}}}],props:{clsActivated:Boolean,easing:String,index:Number,finite:Boolean,velocity:Number,selSlides:String},data:function(){return {easing:"ease",finite:!1,velocity:1,index:0,prevIndex:-1,stack:[],percent:0,clsActive:"uk-active",clsActivated:!1,Transitioner:!1,transitionOptions:{}}},connected:function(){this.prevIndex=-1,this.index=this.getValidIndex(this.index),this.stack=[];},disconnected:function(){Be(this.slides,this.clsActive);},computed:{duration:function(t,e){var i=t.velocity;return Rr(e.offsetWidth/i)},list:function(t,e){return Me(t.selList,e)},maxIndex:function(){return this.length-1},selSlides:function(t){return t.selList+" "+(t.selSlides||"> *")},slides:{get:function(){return Ne(this.selSlides,this.$el)},watch:function(){this.$reset();}},length:function(){return this.slides.length}},events:{itemshown:function(){this.$update(this.list);}},methods:{show:function(t,e){var i=this;if(void 0===e&&(e=!1),!this.dragging&&this.length){var n=this.stack,r=e?0:n.length,o=function(){n.splice(r,1),n.length&&i.show(n.shift(),!0);};if(n[e?"unshift":"push"](t),!e&&1<n.length)2===n.length&&this._transitioner.forward(Math.min(this.duration,200));else {var s=this.getIndex(this.index),a=He(this.slides,this.clsActive)&&this.slides[s],h=this.getIndex(t,this.index),u=this.slides[h];if(a!==u){var c,l;if(this.dir=(l=s,"next"!==(c=t)&&("previous"===c||c<l)?-1:1),this.prevIndex=s,this.index=h,a&&!Jt(a,"beforeitemhide",[this])||!Jt(u,"beforeitemshow",[this,a]))return this.index=this.prevIndex,void o();var d=this._show(a,u,e).then(function(){return a&&Jt(a,"itemhidden",[i]),Jt(u,"itemshown",[i]),new ae(function(t){xi.write(function(){n.shift(),n.length?i.show(n.shift(),!0):i._transitioner=null,t();});})});return a&&Jt(a,"itemhide",[this]),Jt(u,"itemshow",[this]),d}o();}}},getIndex:function(t,e){return void 0===t&&(t=this.index),void 0===e&&(e=this.index),tt(me(t,this.slides,e,this.finite),0,this.maxIndex)},getValidIndex:function(t,e){return void 0===t&&(t=this.index),void 0===e&&(e=this.prevIndex),this.getIndex(t,e)},_show:function(t,e,i){if(this._transitioner=this._getTransitioner(t,e,this.dir,G({easing:i?e.offsetWidth<600?"cubic-bezier(0.25, 0.46, 0.45, 0.94)":"cubic-bezier(0.165, 0.84, 0.44, 1)":this.easing},this.transitionOptions)),!i&&!t)return this._translate(1),ae.resolve();var n=this.stack.length;return this._transitioner[1<n?"forward":"show"](1<n?Math.min(this.duration,75+75/(n-1)):this.duration,this.percent)},_getDistance:function(t,e){return this._getTransitioner(t,t!==e&&e).getDistance()},_translate:function(t,e,i){void 0===e&&(e=this.prevIndex),void 0===i&&(i=this.index);var n=this._getTransitioner(e!==i&&e,i);return n.translate(t),n},_getTransitioner:function(t,e,i,n){return void 0===t&&(t=this.prevIndex),void 0===e&&(e=this.index),void 0===i&&(i=this.dir||1),void 0===n&&(n=this.transitionOptions),new this.Transitioner(B(t)?this.slides[t]:t,B(e)?this.slides[e]:e,i*(lt?-1:1),n)}}};function Rr(t){return .5*t+300}var qr={mixins:[Vr],props:{animation:String},data:{animation:"slide",clsActivated:"uk-transition-active",Animations:Or,Transitioner:function(o,s,a,t){var e=t.animation,h=t.easing,i=e.percent,n=e.translate,r=e.show;void 0===r&&(r=et);var u=r(a),c=new se;return {dir:a,show:function(t,e,i){var n=this;void 0===e&&(e=0);var r=i?"linear":h;return t-=Math.round(t*tt(e,-1,1)),this.translate(e),Wr(s,"itemin",{percent:e,duration:t,timing:r,dir:a}),Wr(o,"itemout",{percent:1-e,duration:t,timing:r,dir:a}),ae.all([Qe.start(s,u[1],t,r),Qe.start(o,u[0],t,r)]).then(function(){n.reset(),c.resolve();},et),c.promise},stop:function(){return Qe.stop([s,o])},cancel:function(){Qe.cancel([s,o]);},reset:function(){for(var t in u[0])Re([s,o],t,"");},forward:function(t,e){return void 0===e&&(e=this.percent()),Qe.cancel([s,o]),this.show(t,e,!0)},translate:function(t){this.reset();var e=n(t,a);Re(s,e[1]),Re(o,e[0]),Wr(s,"itemtranslatein",{percent:t,dir:a}),Wr(o,"itemtranslateout",{percent:1-t,dir:a});},percent:function(){return i(o||s,s,a)},getDistance:function(){return o&&o.offsetWidth}}}},computed:{animation:function(t){var e=t.animation,i=t.Animations;return G(i[e]||i.slide,{name:e})},transitionOptions:function(){return {animation:this.animation}}},events:{"itemshow itemhide itemshown itemhidden":function(t){var e=t.target;this.$update(e);},beforeitemshow:function(t){De(t.target,this.clsActive);},itemshown:function(t){De(t.target,this.clsActivated);},itemhidden:function(t){Be(t.target,this.clsActive,this.clsActivated);}}},Ur={mixins:[or,ar,un,qr],functional:!0,props:{delayControls:Number,preload:Number,videoAutoplay:Boolean,template:String},data:function(){return {preload:1,videoAutoplay:!1,delayControls:3e3,items:[],cls:"uk-open",clsPage:"uk-lightbox-page",selList:".uk-lightbox-items",attrItem:"uk-lightbox-item",selClose:".uk-close-large",selCaption:".uk-lightbox-caption",pauseOnHover:!1,velocity:2,Animations:jr,template:'<div class="uk-lightbox uk-overflow-hidden"> <ul class="uk-lightbox-items"></ul> <div class="uk-lightbox-toolbar uk-position-top uk-text-right uk-transition-slide-top uk-transition-opaque"> <button class="uk-lightbox-toolbar-icon uk-close-large" type="button" uk-close></button> </div> <a class="uk-lightbox-button uk-position-center-left uk-position-medium uk-transition-fade" href uk-slidenav-previous uk-lightbox-item="previous"></a> <a class="uk-lightbox-button uk-position-center-right uk-position-medium uk-transition-fade" href uk-slidenav-next uk-lightbox-item="next"></a> <div class="uk-lightbox-toolbar uk-lightbox-caption uk-position-bottom uk-text-center uk-transition-slide-bottom uk-transition-opaque"></div> </div>'}},created:function(){var t=Me(this.template),e=Me(this.selList,t);this.items.forEach(function(){return be(e,"<li>")}),this.$mount(be(this.container,t));},computed:{caption:function(t,e){t.selCaption;return Me(".uk-lightbox-caption",e)}},events:[{name:mt+" "+gt+" keydown",handler:"showControls"},{name:"click",self:!0,delegate:function(){return this.selSlides},handler:function(t){t.defaultPrevented||this.hide();}},{name:"shown",self:!0,handler:function(){this.showControls();}},{name:"hide",self:!0,handler:function(){this.hideControls(),Be(this.slides,this.clsActive),Qe.stop(this.slides);}},{name:"hidden",self:!0,handler:function(){this.$destroy(!0);}},{name:"keyup",el:ut&&document,handler:function(t){if(this.isToggled(this.$el)&&this.draggable)switch(t.keyCode){case 37:this.show("previous");break;case 39:this.show("next");}}},{name:"beforeitemshow",handler:function(t){this.isToggled()||(this.draggable=!1,t.preventDefault(),this.toggleElement(this.$el,!0,!1),this.animation=jr.scale,Be(t.target,this.clsActive),this.stack.splice(1,0,this.index));}},{name:"itemshow",handler:function(){we(this.caption,this.getItem().caption||"");for(var t=-this.preload;t<=this.preload;t++)this.loadItem(this.index+t);}},{name:"itemshown",handler:function(){this.draggable=this.$props.draggable;}},{name:"itemload",handler:function(t,r){var o=this,n=r.source,e=r.type,s=r.alt;void 0===s&&(s="");var i=r.poster,a=r.attrs;if(void 0===a&&(a={}),this.setItem(r,"<span uk-spinner></span>"),n){var h,u={frameborder:"0",allow:"autoplay",allowfullscreen:"",style:"max-width: 100%; box-sizing: border-box;","uk-responsive":"","uk-video":""+this.videoAutoplay};if("image"===e||n.match(/\.(jpe?g|png|gif|svg|webp)($|\?)/i))fe(n,a.srcset,a.size).then(function(t){var e=t.width,i=t.height;return o.setItem(r,Yr("img",G({src:n,width:e,height:i,alt:s},a)))},function(){return o.setError(r)});else if("video"===e||n.match(/\.(mp4|webm|ogv)($|\?)/i)){var c=Yr("video",G({src:n,poster:i,controls:"",playsinline:"","uk-video":""+this.videoAutoplay},a));Xt(c,"loadedmetadata",function(){ot(c,{width:c.videoWidth,height:c.videoHeight}),o.setItem(r,c);}),Xt(c,"error",function(){return o.setError(r)});}else "iframe"===e||n.match(/\.(html|php)($|\?)/i)?this.setItem(r,Yr("iframe",G({src:n,frameborder:"0",allowfullscreen:"",class:"uk-lightbox-iframe"},a))):(h=n.match(/\/\/(?:.*?youtube(-nocookie)?\..*?[?&]v=|youtu\.be\/)([\w-]{11})[&?]?(.*)?/))?this.setItem(r,Yr("iframe",G({src:"https://www.youtube"+(h[1]||"")+".com/embed/"+h[2]+(h[3]?"?"+h[3]:""),width:1920,height:1080},u,a))):(h=n.match(/\/\/.*?vimeo\.[a-z]+\/(\d+)[&?]?(.*)?/))&&de("https://vimeo.com/api/oembed.json?maxwidth=1920&url="+encodeURI(n),{responseType:"json",withCredentials:!1}).then(function(t){var e=t.response,i=e.height,n=e.width;return o.setItem(r,Yr("iframe",G({src:"https://player.vimeo.com/video/"+h[1]+(h[2]?"?"+h[2]:""),width:n,height:i},u,a)))},function(){return o.setError(r)});}}}],methods:{loadItem:function(t){void 0===t&&(t=this.index);var e=this.getItem(t);this.getSlide(e).childElementCount||Jt(this.$el,"itemload",[e]);},getItem:function(t){return void 0===t&&(t=this.index),this.items[me(t,this.slides)]},setItem:function(t,e){Jt(this.$el,"itemloaded",[this,we(this.getSlide(t),e)]);},getSlide:function(t){return this.slides[this.items.indexOf(t)]},setError:function(t){this.setItem(t,'<span uk-icon="icon: bolt; ratio: 2"></span>');},showControls:function(){clearTimeout(this.controlsTimer),this.controlsTimer=setTimeout(this.hideControls,this.delayControls),De(this.$el,"uk-active","uk-transition-active");},hideControls:function(){Be(this.$el,"uk-active","uk-transition-active");}}};function Yr(t,e){var i=Ce("<"+t+">");return ot(i,e),i}var Xr,Gr={install:function(t,e){t.lightboxPanel||t.component("lightboxPanel",Ur);G(e.props,t.component("lightboxPanel").options.props);},props:{toggle:String},data:{toggle:"a"},computed:{toggles:{get:function(t,e){return Ne(t.toggle,e)},watch:function(){this.hide();}}},disconnected:function(){this.hide();},events:[{name:"click",delegate:function(){return this.toggle+":not(.uk-disabled)"},handler:function(t){t.preventDefault(),this.show(t.current);}}],methods:{show:function(t){var e=this,i=Q(this.toggles.map(Kr),"source");if(M(t)){var n=Kr(t).source;t=y(i,function(t){var e=t.source;return n===e});}return this.panel=this.panel||this.$create("lightboxPanel",G({},this.$props,{items:i})),Xt(this.panel.$el,"hidden",function(){return e.panel=!1}),this.panel.show(t)},hide:function(){return this.panel&&this.panel.hide()}}};function Kr(e){var i={};return ["href","caption","type","poster","alt","attrs"].forEach(function(t){i["href"===t?"source":t]=ht(e,t);}),i.attrs=Mi(i.attrs),i}var Jr={functional:!0,args:["message","status"],data:{message:"",status:"",timeout:5e3,group:null,pos:"top-center",clsContainer:"uk-notification",clsClose:"uk-notification-close",clsMsg:"uk-notification-message"},install:function(r){r.notification.closeAll=function(i,n){Ae(document.body,function(t){var e=r.getComponent(t,"notification");!e||i&&i!==e.group||e.close(n);});};},computed:{marginProp:function(t){return "margin"+(w(t.pos,"top")?"Top":"Bottom")},startProps:function(){var t;return (t={opacity:0})[this.marginProp]=-this.$el.offsetHeight,t}},created:function(){var t=Me("."+this.clsContainer+"-"+this.pos,this.$container)||be(this.$container,'<div class="'+this.clsContainer+" "+this.clsContainer+"-"+this.pos+'" style="display: block"></div>');this.$mount(be(t,'<div class="'+this.clsMsg+(this.status?" "+this.clsMsg+"-"+this.status:"")+'"> <a href class="'+this.clsClose+'" data-uk-close></a> <div>'+this.message+"</div> </div>"));},connected:function(){var t,e=this,i=j(Re(this.$el,this.marginProp));Qe.start(Re(this.$el,this.startProps),((t={opacity:1})[this.marginProp]=i,t)).then(function(){e.timeout&&(e.timer=setTimeout(e.close,e.timeout));});},events:((Xr={click:function(t){Bt(t.target,'a[href="#"],a[href=""]')&&t.preventDefault(),this.close();}})[wt]=function(){this.timer&&clearTimeout(this.timer);},Xr[bt]=function(){this.timeout&&(this.timer=setTimeout(this.close,this.timeout));},Xr),methods:{close:function(t){function e(){var t=i.$el.parentNode;Jt(i.$el,"close",[i]),$e(i.$el),t&&!t.hasChildNodes()&&$e(t);}var i=this;this.timer&&clearTimeout(this.timer),t?e():Qe.start(this.$el,this.startProps).then(e);}}};var Zr=["x","y","bgx","bgy","rotate","scale","color","backgroundColor","borderColor","opacity","blur","hue","grayscale","invert","saturate","sepia","fopacity","stroke"],Qr={mixins:[nr],props:Zr.reduce(function(t,e){return t[e]="list",t},{}),data:Zr.reduce(function(t,e){return t[e]=void 0,t},{}),computed:{props:function(g,m){var v=this;return Zr.reduce(function(t,e){if(H(g[e]))return t;var i,n,r,o=e.match(/color/i),s=o||"opacity"===e,a=g[e].slice(0);s&&Re(m,e,""),a.length<2&&a.unshift(("scale"===e?1:s?Re(m,e):0)||0);var h=a.reduce(function(t,e){return D(e)&&e.replace(/-|\d/g,"").trim()||t},"");if(o){var u=m.style.color;a=a.map(function(t){return Re(Re(m,"color",t),"color").split(/[(),]/g).slice(1,-1).concat(1).slice(0,4).map(j)}),m.style.color=u;}else if(w(e,"bg")){var c="bgy"===e?"height":"width";if(a=a.map(function(t){return wi(t,c,v.$el)}),Re(m,"background-position-"+e[2],""),n=Re(m,"backgroundPosition").split(" ")["x"===e[2]?0:1],v.covers){var l=Math.min.apply(Math,a),d=Math.max.apply(Math,a),f=a.indexOf(l)<a.indexOf(d);r=d-l,a=a.map(function(t){return t-(f?l:d)}),i=(f?-r:0)+"px";}else i=n;}else a=a.map(j);if("stroke"===e){if(!a.some(function(t){return t}))return t;var p=Pn(v.$el);Re(m,"strokeDasharray",p),"%"===h&&(a=a.map(function(t){return t*p/100})),a=a.reverse(),e="strokeDashoffset";}return t[e]={steps:a,unit:h,pos:i,bgPos:n,diff:r},t},{})},bgProps:function(){var e=this;return ["bgx","bgy"].filter(function(t){return t in e.props})},covers:function(t,e){return n=(i=e).style.backgroundSize,r="cover"===Re(Re(i,"backgroundSize",""),"backgroundSize"),i.style.backgroundSize=n,r;var i,n,r;}},disconnected:function(){delete this._image;},update:{read:function(t){var h=this;if(t.active=this.matchMedia,t.active){if(!t.image&&this.covers&&this.bgProps.length){var e=Re(this.$el,"backgroundImage").replace(/^none|url\(["']?(.+?)["']?\)$/,"$1");if(e){var i=new Image;i.src=e,(t.image=i).naturalWidth||(i.onload=function(){return h.$update()});}}var n=t.image;if(n&&n.naturalWidth){var u={width:this.$el.offsetWidth,height:this.$el.offsetHeight},c={width:n.naturalWidth,height:n.naturalHeight},l=rt.cover(c,u);this.bgProps.forEach(function(t){var e=h.props[t],i=e.diff,n=e.bgPos,r=e.steps,o="bgy"===t?"height":"width",s=l[o]-u[o];if(s<i)u[o]=l[o]+i-s;else if(i<s){var a=u[o]/wi(n,o,h.$el);a&&(h.props[t].steps=r.map(function(t){return t-(s-i)/a}));}l=rt.cover(c,u);}),t.dim=l;}}},write:function(t){var e=t.dim;t.active?e&&Re(this.$el,{backgroundSize:e.width+"px "+e.height+"px",backgroundRepeat:"no-repeat"}):Re(this.$el,{backgroundSize:"",backgroundRepeat:""});},events:["resize"]},methods:{reset:function(){var i=this;J(this.getCss(0),function(t,e){return Re(i.$el,e,"")});},getCss:function(l){var d=this.props;return Object.keys(d).reduce(function(t,e){var i=d[e],n=i.steps,r=i.unit,o=i.pos,s=function(t,e,i){void 0===i&&(i=2);var n=to(t,e),r=n[0],o=n[1],s=n[2];return (B(r)?r+Math.abs(r-o)*s*(r<o?1:-1):+o).toFixed(i)}(n,l);switch(e){case"x":case"y":r=r||"px",t.transform+=" translate"+p(e)+"("+j(s).toFixed("px"===r?0:2)+r+")";break;case"rotate":r=r||"deg",t.transform+=" rotate("+(s+r)+")";break;case"scale":t.transform+=" scale("+s+")";break;case"bgy":case"bgx":t["background-position-"+e[2]]="calc("+o+" + "+s+"px)";break;case"color":case"backgroundColor":case"borderColor":var a=to(n,l),h=a[0],u=a[1],c=a[2];t[e]="rgba("+h.map(function(t,e){return t+=c*(u[e]-t),3===e?j(t):parseInt(t,10)}).join(",")+")";break;case"blur":r=r||"px",t.filter+=" blur("+(s+r)+")";break;case"hue":r=r||"deg",t.filter+=" hue-rotate("+(s+r)+")";break;case"fopacity":r=r||"%",t.filter+=" opacity("+(s+r)+")";break;case"grayscale":case"invert":case"saturate":case"sepia":r=r||"%",t.filter+=" "+e+"("+(s+r)+")";break;default:t[e]=s;}return t},{transform:"",filter:""})}}};function to(t,e){var i=t.length-1,n=Math.min(Math.floor(i*e),i-1),r=t.slice(n,n+2);return r.push(1===e?1:e%(1/i)*i),r}var eo={mixins:[Qr],props:{target:String,viewport:Number,easing:Number},data:{target:!1,viewport:1,easing:1},computed:{target:function(t,e){var i=t.target;return function t(e){return e?"offsetTop"in e?e:t(e.parentNode):document.body}(i&&yt(i,e)||e)}},update:{read:function(t,e){var i=t.percent;if("scroll"!==e&&(i=!1),t.active){var n,r,o=i;return n=Hi(this.target)/(this.viewport||1),r=this.easing,{percent:i=tt(n*(1-(r-r*n))),style:o!==i&&this.getCss(i)}}},write:function(t){var e=t.style;t.active?e&&Re(this.$el,e):this.reset();},events:["scroll","resize"]}};var io={update:{write:function(){if(!this.stack.length&&!this.dragging){var t=this.getValidIndex(this.index);~this.prevIndex&&this.index===t||this.show(t);}},events:["resize"]}};function no(t,e,i){var n,r=so(t,e);return i?r-(n=t,si(e).width/2-si(n).width/2):Math.min(r,ro(e))}function ro(t){return Math.max(0,oo(t)-si(t).width)}function oo(t){return ho(t).reduce(function(t,e){return si(e).width+t},0)}function so(t,e){return (hi(t).left+(lt?si(t).width-si(e).width:0))*(lt?-1:1)}function ao(t,e,i){Jt(t,Zt(e,!1,!1,i));}function ho(t){return Yt(t)}var uo={mixins:[hn,Vr,io],props:{center:Boolean,sets:Boolean},data:{center:!1,sets:!1,attrItem:"uk-slider-item",selList:".uk-slider-items",selNav:".uk-slider-nav",clsContainer:"uk-slider-container",Transitioner:function(r,n,o,t){var e=t.center,s=t.easing,a=t.list,h=new se,i=r?no(r,a,e):no(n,a,e)+si(n).width*o,u=n?no(n,a,e):i+si(r).width*o*(lt?-1:1);return {dir:o,show:function(t,e,i){void 0===e&&(e=0);var n=i?"linear":s;return t-=Math.round(t*tt(e,-1,1)),this.translate(e),r&&this.updateTranslates(),e=r?e:tt(e,0,1),ao(this.getItemIn(),"itemin",{percent:e,duration:t,timing:n,dir:o}),r&&ao(this.getItemIn(!0),"itemout",{percent:1-e,duration:t,timing:n,dir:o}),Qe.start(a,{transform:Lr(-u*(lt?-1:1),"px")},t,n).then(h.resolve,et),h.promise},stop:function(){return Qe.stop(a)},cancel:function(){Qe.cancel(a);},reset:function(){Re(a,"transform","");},forward:function(t,e){return void 0===e&&(e=this.percent()),Qe.cancel(a),this.show(t,e,!0)},translate:function(t){var e=this.getDistance()*o*(lt?-1:1);Re(a,"transform",Lr(tt(e-e*t-u,-oo(a),si(a).width)*(lt?-1:1),"px")),this.updateTranslates(),r&&(t=tt(t,-1,1),ao(this.getItemIn(),"itemtranslatein",{percent:t,dir:o}),ao(this.getItemIn(!0),"itemtranslateout",{percent:1-t,dir:o}));},percent:function(){return Math.abs((Re(a,"transform").split(",")[4]*(lt?-1:1)+i)/(u-i))},getDistance:function(){return Math.abs(u-i)},getItemIn:function(t){void 0===t&&(t=!1);var e=this.getActives(),i=Z(ho(a),"offsetLeft"),n=ge(i,e[0<o*(t?-1:1)?e.length-1:0]);return ~n&&i[n+(r&&!t?o:0)]},getActives:function(){var i=no(r||n,a,e);return Z(ho(a).filter(function(t){var e=so(t,a);return i<=e&&e+si(t).width<=si(a).width+i}),"offsetLeft")},updateTranslates:function(){var i=this.getActives();ho(a).forEach(function(t){var e=b(i,t);ao(t,"itemtranslate"+(e?"in":"out"),{percent:e?1:0,dir:t.offsetLeft<=n.offsetLeft?1:-1});});}}}},computed:{avgWidth:function(){return oo(this.list)/this.length},finite:function(t){return t.finite||Math.ceil(oo(this.list))<si(this.list).width+ho(this.list).reduce(function(t,e){return Math.max(t,si(e).width)},0)+this.center},maxIndex:function(){if(!this.finite||this.center&&!this.sets)return this.length-1;if(this.center)return K(this.sets);Re(this.slides,"order","");for(var t=ro(this.list),e=this.length;e--;)if(so(this.list.children[e],this.list)<t)return Math.min(e+1,this.length-1);return 0},sets:function(t){var o=this,e=t.sets,s=si(this.list).width/(this.center?2:1),a=0,h=s,u=0;return !O(e=e&&this.slides.reduce(function(t,e,i){var n=si(e).width;if(a<u+n&&(!o.center&&i>o.maxIndex&&(i=o.maxIndex),!b(t,i))){var r=o.slides[i+1];o.center&&r&&n<h-si(r).width/2?h-=n:(h=s,t.push(i),a=u+s+(o.center?n/2:0));}return u+=n,t},[]))&&e},transitionOptions:function(){return {center:this.center,list:this.list}}},connected:function(){Le(this.$el,this.clsContainer,!Me("."+this.clsContainer,this.$el));},update:{write:function(){var i=this;Ne("["+this.attrItem+"],[data-"+this.attrItem+"]",this.$el).forEach(function(t){var e=ht(t,i.attrItem);i.maxIndex&&Le(t,"uk-hidden",P(e)&&(i.sets&&!b(i.sets,j(e))||e>i.maxIndex));}),!this.length||this.dragging||this.stack.length||(this.reorder(),this._translate(1));var e=this._getTransitioner(this.index).getActives();this.slides.forEach(function(t){return Le(t,i.clsActive,b(e,t))}),this.sets&&!b(this.sets,j(this.index))||this.slides.forEach(function(t){return Le(t,i.clsActivated,b(e,t))});},events:["resize"]},events:{beforeitemshow:function(t){!this.dragging&&this.sets&&this.stack.length<2&&!b(this.sets,this.index)&&(this.index=this.getValidIndex());var e=Math.abs(this.index-this.prevIndex+(0<this.dir&&this.index<this.prevIndex||this.dir<0&&this.index>this.prevIndex?(this.maxIndex+1)*this.dir:0));if(!this.dragging&&1<e){for(var i=0;i<e;i++)this.stack.splice(1,0,0<this.dir?"next":"previous");t.preventDefault();}else this.duration=Rr(this.avgWidth/this.velocity)*(si(this.dir<0||!this.slides[this.prevIndex]?this.slides[this.index]:this.slides[this.prevIndex]).width/this.avgWidth),this.reorder();},itemshow:function(){~this.prevIndex&&De(this._getTransitioner().getItemIn(),this.clsActive);}},methods:{reorder:function(){var i=this;if(this.finite)Re(this.slides,"order","");else {var n=0<this.dir&&this.slides[this.prevIndex]?this.prevIndex:this.index;if(this.slides.forEach(function(t,e){return Re(t,"order",0<i.dir&&e<n?1:i.dir<0&&e>=i.index?-1:"")}),this.center)for(var t=this.slides[n],e=si(this.list).width/2-si(t).width/2,r=0;0<e;){var o=this.getIndex(--r+n,n),s=this.slides[o];Re(s,"order",n<o?-2:-1),e-=si(s).width;}}},getValidIndex:function(t,e){if(void 0===t&&(t=this.index),void 0===e&&(e=this.prevIndex),t=this.getIndex(t,e),!this.sets)return t;var i;do{if(b(this.sets,t))return t;i=t,t=this.getIndex(t+this.dir,e);}while(t!==i);return t}}},co={mixins:[Qr],data:{selItem:"!li"},computed:{item:function(t,e){return yt(t.selItem,e)}},events:[{name:"itemshown",self:!0,el:function(){return this.item},handler:function(){Re(this.$el,this.getCss(.5));}},{name:"itemin itemout",self:!0,el:function(){return this.item},handler:function(t){var e=t.type,i=t.detail,n=i.percent,r=i.duration,o=i.timing,s=i.dir;Qe.cancel(this.$el),Re(this.$el,this.getCss(fo(e,s,n))),Qe.start(this.$el,this.getCss(lo(e)?.5:0<s?1:0),r,o).catch(et);}},{name:"transitioncanceled transitionend",self:!0,el:function(){return this.item},handler:function(){Qe.cancel(this.$el);}},{name:"itemtranslatein itemtranslateout",self:!0,el:function(){return this.item},handler:function(t){var e=t.type,i=t.detail,n=i.percent,r=i.dir;Qe.cancel(this.$el),Re(this.$el,this.getCss(fo(e,r,n)));}}]};function lo(t){return u(t,"in")}function fo(t,e,i){return i/=2,lo(t)?e<0?1-i:i:e<0?i:1-i}var po,go,mo=G({},Or,{fade:{show:function(){return [{opacity:0,zIndex:0},{zIndex:-1}]},percent:function(t){return 1-Re(t,"opacity")},translate:function(t){return [{opacity:1-t,zIndex:0},{zIndex:-1}]}},scale:{show:function(){return [{opacity:0,transform:Fr(1.5),zIndex:0},{zIndex:-1}]},percent:function(t){return 1-Re(t,"opacity")},translate:function(t){return [{opacity:1-t,transform:Fr(1+.5*t),zIndex:0},{zIndex:-1}]}},pull:{show:function(t){return t<0?[{transform:Lr(30),zIndex:-1},{transform:Lr(),zIndex:0}]:[{transform:Lr(-100),zIndex:0},{transform:Lr(),zIndex:-1}]},percent:function(t,e,i){return i<0?1-Hr(e):Hr(t)},translate:function(t,e){return e<0?[{transform:Lr(30*t),zIndex:-1},{transform:Lr(-100*(1-t)),zIndex:0}]:[{transform:Lr(100*-t),zIndex:0},{transform:Lr(30*(1-t)),zIndex:-1}]}},push:{show:function(t){return t<0?[{transform:Lr(100),zIndex:0},{transform:Lr(),zIndex:-1}]:[{transform:Lr(-30),zIndex:-1},{transform:Lr(),zIndex:0}]},percent:function(t,e,i){return 0<i?1-Hr(e):Hr(t)},translate:function(t,e){return e<0?[{transform:Lr(100*t),zIndex:0},{transform:Lr(-30*(1-t)),zIndex:-1}]:[{transform:Lr(-30*t),zIndex:-1},{transform:Lr(100*(1-t)),zIndex:0}]}}}),vo={mixins:[hn,qr,io],props:{ratio:String,minHeight:Number,maxHeight:Number},data:{ratio:"16:9",minHeight:!1,maxHeight:!1,selList:".uk-slideshow-items",attrItem:"uk-slideshow-item",selNav:".uk-slideshow-nav",Animations:mo},update:{read:function(){var t=this.ratio.split(":").map(Number),e=t[0],i=t[1];return i=i*this.list.offsetWidth/e||0,this.minHeight&&(i=Math.max(this.minHeight,i)),this.maxHeight&&(i=Math.min(this.maxHeight,i)),{height:i-fi(this.list,"height","content-box")}},write:function(t){var e=t.height;0<e&&Re(this.list,"minHeight",e);},events:["resize"]}},wo={mixins:[hn,Ar],props:{group:String,threshold:Number,clsItem:String,clsPlaceholder:String,clsDrag:String,clsDragState:String,clsBase:String,clsNoDrag:String,clsEmpty:String,clsCustom:String,handle:String},data:{group:!1,threshold:5,clsItem:"uk-sortable-item",clsPlaceholder:"uk-sortable-placeholder",clsDrag:"uk-sortable-drag",clsDragState:"uk-drag",clsBase:"uk-sortable",clsNoDrag:"uk-sortable-nodrag",clsEmpty:"uk-sortable-empty",clsCustom:"",handle:!1,pos:{}},created:function(){var i=this;["init","start","move","end"].forEach(function(t){var e=i[t];i[t]=function(t){G(i.pos,oe(t)),e(t);};});},events:{name:gt,passive:!1,handler:"init"},computed:{target:function(){return (this.$el.tBodies||[this.$el])[0]},items:function(){return Yt(this.target)},isEmpty:{get:function(){return O(this.items)},watch:function(t){Le(this.target,this.clsEmpty,t);},immediate:!0},handles:{get:function(t,e){var i=t.handle;return i?Ne(i,e):this.items},watch:function(t,e){Re(e,{touchAction:"",userSelect:""}),Re(t,{touchAction:pt?"none":"",userSelect:"none"});},immediate:!0}},update:{write:function(){if(this.drag&&Pt(this.placeholder)){var t=this.pos,e=t.x,i=t.y,n=this.origin,r=n.offsetTop,o=n.offsetLeft,s=this.drag,a=s.offsetHeight,h=s.offsetWidth,u=si(window),c=u.right,l=u.bottom,d=document.elementFromPoint(e,i);Re(this.drag,{top:tt(i-r,0,l-a),left:tt(e-o,0,c-h)});var f=this.getSortable(d),p=this.getSortable(this.placeholder),g=f!==p;if(f&&!qt(d,this.placeholder)&&(!g||f.group&&f.group===p.group)){if(d=f.target===d.parentNode&&d||f.items.filter(function(t){return qt(d,t)})[0],g)p.remove(this.placeholder);else if(!d)return;f.insert(this.placeholder,d),b(this.touched,f)||this.touched.push(f);}}},events:["move"]},methods:{init:function(t){var e=t.target,i=t.button,n=t.defaultPrevented,r=this.items.filter(function(t){return qt(e,t)})[0];!r||n||0<i||Vt(e)||qt(e,"."+this.clsNoDrag)||this.handle&&!qt(e,this.handle)||(t.preventDefault(),this.touched=[this],this.placeholder=r,this.origin=G({target:e,index:ge(r)},this.pos),Xt(document,mt,this.move),Xt(document,vt,this.end),this.threshold||this.start(t));},start:function(t){var e,i,n;this.drag=(e=this.$container,i=this.placeholder,ot(n=be(e,i.outerHTML.replace(/(^<)(?:li|tr)|(?:li|tr)(\/>$)/g,"$1div$2")),"style",ot(n,"style")+";margin:0!important"),Re(n,G({boxSizing:"border-box",width:i.offsetWidth,height:i.offsetHeight,overflow:"hidden"},Re(i,["paddingLeft","paddingRight","paddingTop","paddingBottom"]))),ci(n.firstElementChild,ci(i.firstElementChild)),n);var r,o,s=this.placeholder.getBoundingClientRect(),a=s.left,h=s.top;G(this.origin,{offsetLeft:this.pos.x-a,offsetTop:this.pos.y-h}),De(this.drag,this.clsDrag,this.clsCustom),De(this.placeholder,this.clsPlaceholder),De(this.items,this.clsItem),De(document.documentElement,this.clsDragState),Jt(this.$el,"start",[this,this.placeholder]),r=this.pos,o=Date.now(),po=setInterval(function(){var t=r.x,a=r.y;a+=window.pageYOffset;var h=.3*(Date.now()-o);o=Date.now(),Li(document.elementFromPoint(t,r.y)).some(function(t){var e=t.scrollTop,i=t.scrollHeight,n=si(Fi(t)),r=n.top,o=n.bottom,s=n.height;if(r<a&&a<r+30)e-=h;else {if(!(a<o&&o-30<a))return;e+=h;}if(0<e&&e<i-s)return Pi(t,e),!0});},15),this.move(t);},move:function(t){this.drag?this.$emit("move"):(Math.abs(this.pos.x-this.origin.x)>this.threshold||Math.abs(this.pos.y-this.origin.y)>this.threshold)&&this.start(t);},end:function(t){if(Gt(document,mt,this.move),Gt(document,vt,this.end),Gt(window,"scroll",this.scroll),this.drag){clearInterval(po);var e=this.getSortable(this.placeholder);this===e?this.origin.index!==ge(this.placeholder)&&Jt(this.$el,"moved",[this,this.placeholder]):(Jt(e.$el,"added",[e,this.placeholder]),Jt(this.$el,"removed",[this,this.placeholder])),Jt(this.$el,"stop",[this,this.placeholder]),$e(this.drag),this.drag=null;var i=this.touched.map(function(t){return t.clsPlaceholder+" "+t.clsItem}).join(" ");this.touched.forEach(function(t){return Be(t.items,i)}),Be(document.documentElement,this.clsDragState);}else "touchend"===t.type&&t.target.click();},insert:function(i,n){var r=this;De(this.items,this.clsItem);function t(){var t,e;n?(!qt(i,r.target)||(e=n,(t=i).parentNode===e.parentNode&&ge(t)>ge(e))?xe:ye)(n,i):be(r.target,i);}this.animation?this.animate(t):t();},remove:function(t){qt(t,this.target)&&(this.animation?this.animate(function(){return $e(t)}):$e(t));},getSortable:function(t){return t&&(this.$getComponent(t,"sortable")||this.getSortable(t.parentNode))}}};var bo=[],xo={mixins:[or,un,vn],args:"title",props:{delay:Number,title:String},data:{pos:"top",title:"",delay:0,animation:["uk-animation-scale-up"],duration:100,cls:"uk-active",clsPos:"uk-tooltip"},beforeConnect:function(){this._hasTitle=st(this.$el,"title"),ot(this.$el,{title:"","aria-expanded":!1});},disconnected:function(){this.hide(),ot(this.$el,{title:this._hasTitle?this.title:null,"aria-expanded":null});},methods:{show:function(){var e=this;!this.isActive()&&this.title&&(bo.forEach(function(t){return t.hide()}),bo.push(this),this._unbind=Xt(document,vt,function(t){return !qt(t.target,e.$el)&&e.hide()}),clearTimeout(this.showTimer),this.showTimer=setTimeout(this._show,this.delay));},hide:function(){var t=this;this.isActive()&&!zt(this.$el,"input:focus")&&this.toggleElement(this.tooltip,!1,!1).then(function(){bo.splice(bo.indexOf(t),1),clearTimeout(t.showTimer),t.tooltip=$e(t.tooltip),t._unbind();});},_show:function(){var e=this;this.tooltip=be(this.container,'<div class="'+this.clsPos+'"> <div class="'+this.clsPos+'-inner">'+this.title+"</div> </div>"),Xt(this.tooltip,"toggled",function(){var t=e.isToggled(e.tooltip);ot(e.$el,"aria-expanded",t),t&&(e.positionAt(e.tooltip,e.$el),e.origin="y"===e.getAxis()?vi(e.dir)+"-"+e.align:e.align+"-"+vi(e.dir));}),this.toggleElement(this.tooltip,!0);},isActive:function(){return b(bo,this)}},events:((go={focus:"show",blur:"hide"})[wt+" "+bt]=function(t){re(t)||(t.type===wt?this.show():this.hide());},go[gt]=function(t){re(t)&&(this.isActive()?this.hide():this.show());},go)},yo={props:{allow:String,clsDragover:String,concurrent:Number,maxSize:Number,method:String,mime:String,msgInvalidMime:String,msgInvalidName:String,msgInvalidSize:String,multiple:Boolean,name:String,params:Object,type:String,url:String},data:{allow:!1,clsDragover:"uk-dragover",concurrent:1,maxSize:0,method:"POST",mime:!1,msgInvalidMime:"Invalid File Type: %s",msgInvalidName:"Invalid File Name: %s",msgInvalidSize:"Invalid File Size: %s Kilobytes Max",multiple:!1,name:"files[]",params:{},type:"",url:"",abort:et,beforeAll:et,beforeSend:et,complete:et,completeAll:et,error:et,fail:et,load:et,loadEnd:et,loadStart:et,progress:et},events:{change:function(t){zt(t.target,'input[type="file"]')&&(t.preventDefault(),t.target.files&&this.upload(t.target.files),t.target.value="");},drop:function(t){$o(t);var e=t.dataTransfer;e&&e.files&&(Be(this.$el,this.clsDragover),this.upload(e.files));},dragenter:function(t){$o(t);},dragover:function(t){$o(t),De(this.$el,this.clsDragover);},dragleave:function(t){$o(t),Be(this.$el,this.clsDragover);}},methods:{upload:function(t){var n=this;if(t.length){Jt(this.$el,"upload",[t]);for(var e=0;e<t.length;e++){if(this.maxSize&&1e3*this.maxSize<t[e].size)return void this.fail(this.msgInvalidSize.replace("%s",this.maxSize));if(this.allow&&!ko(this.allow,t[e].name))return void this.fail(this.msgInvalidName.replace("%s",this.allow));if(this.mime&&!ko(this.mime,t[e].type))return void this.fail(this.msgInvalidMime.replace("%s",this.mime))}this.multiple||(t=[t[0]]),this.beforeAll(this,t);var r=function(t,e){for(var i=[],n=0;n<t.length;n+=e){for(var r=[],o=0;o<e;o++)r.push(t[n+o]);i.push(r);}return i}(t,this.concurrent),o=function(t){var e=new FormData;for(var i in t.forEach(function(t){return e.append(n.name,t)}),n.params)e.append(i,n.params[i]);de(n.url,{data:e,method:n.method,responseType:n.type,beforeSend:function(t){var e=t.xhr;e.upload&&Xt(e.upload,"progress",n.progress),["loadStart","load","loadEnd","abort"].forEach(function(t){return Xt(e,t.toLowerCase(),n[t])}),n.beforeSend(t);}}).then(function(t){n.complete(t),r.length?o(r.shift()):n.completeAll(t);},function(t){return n.error(t)});};o(r.shift());}}}};function ko(t,e){return e.match(new RegExp("^"+t.replace(/\//g,"\\/").replace(/\*\*/g,"(\\/[^\\/]+)*").replace(/\*/g,"[^\\/]+").replace(/((?!\\))\?/g,"$1.")+"$","i"))}function $o(t){t.preventDefault(),t.stopPropagation();}return J(Object.freeze({__proto__:null,Countdown:Er,Filter:Dr,Lightbox:Gr,LightboxPanel:Ur,Notification:Jr,Parallax:eo,Slider:uo,SliderParallax:co,Slideshow:vo,SlideshowParallax:co,Sortable:wo,Tooltip:xo,Upload:yo}),function(t,e){return qi.component(e,t)}),qi});
    });

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe,
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const LOCATION = {};
    const ROUTER = {};

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    function getLocation(source) {
      return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial"
      };
    }

    function createHistory(source, options) {
      const listeners = [];
      let location = getLocation(source);

      return {
        get location() {
          return location;
        },

        listen(listener) {
          listeners.push(listener);

          const popstateListener = () => {
            location = getLocation(source);
            listener({ location, action: "POP" });
          };

          source.addEventListener("popstate", popstateListener);

          return () => {
            source.removeEventListener("popstate", popstateListener);

            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
          };
        },

        navigate(to, { state, replace = false } = {}) {
          state = { ...state, key: Date.now() + "" };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            if (replace) {
              source.history.replaceState(state, null, to);
            } else {
              source.history.pushState(state, null, to);
            }
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }

          location = getLocation(source);
          listeners.forEach(listener => listener({ location, action: "PUSH" }));
        }
      };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
      let index = 0;
      const stack = [{ pathname: initialPathname, search: "" }];
      const states = [];

      return {
        get location() {
          return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
          get entries() {
            return stack;
          },
          get index() {
            return index;
          },
          get state() {
            return states[index];
          },
          pushState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            index++;
            stack.push({ pathname, search });
            states.push(state);
          },
          replaceState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            stack[index] = { pathname, search };
            states[index] = state;
          }
        }
      };
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = Boolean(
      typeof window !== "undefined" &&
        window.document &&
        window.document.createElement
    );
    const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
    const { navigate } = globalHistory;

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    const paramRe = /^:(.+)/;

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Check if `string` starts with `search`
     * @param {string} string
     * @param {string} search
     * @return {boolean}
     */
    function startsWith(string, search) {
      return string.substr(0, search.length) === search;
    }

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    function isRootSegment(segment) {
      return segment === "";
    }

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    function isDynamic(segment) {
      return paramRe.test(segment);
    }

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    function isSplat(segment) {
      return segment[0] === "*";
    }

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri) {
      return (
        uri
          // Strip starting/ending `/`
          .replace(/(^\/+|\/+$)/g, "")
          .split("/")
      );
    }

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    function stripSlashes(str) {
      return str.replace(/(^\/+|\/+$)/g, "");
    }

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
      const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            score += SEGMENT_POINTS;

            if (isRootSegment(segment)) {
              score += ROOT_POINTS;
            } else if (isDynamic(segment)) {
              score += DYNAMIC_POINTS;
            } else if (isSplat(segment)) {
              score -= SEGMENT_POINTS + SPLAT_PENALTY;
            } else {
              score += STATIC_POINTS;
            }

            return score;
          }, 0);

      return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
      return (
        routes
          .map(rankRoute)
          // If two routes have the exact same score, we go by index instead
          .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
          )
      );
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { path, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
      let match;
      let default_;

      const [uriPathname] = uri.split("?");
      const uriSegments = segmentize(uriPathname);
      const isRootUri = uriSegments[0] === "";
      const ranked = rankRoutes(routes);

      for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
          default_ = {
            route,
            params: {},
            uri
          };
          continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
          const routeSegment = routeSegments[index];
          const uriSegment = uriSegments[index];

          if (routeSegment !== undefined && isSplat(routeSegment)) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/* or /files/*splatname
            const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

            params[splatName] = uriSegments
              .slice(index)
              .map(decodeURIComponent)
              .join("/");
            break;
          }

          if (uriSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true;
            break;
          }

          let dynamicMatch = paramRe.exec(routeSegment);

          if (dynamicMatch && !isRootUri) {
            const value = decodeURIComponent(uriSegment);
            params[dynamicMatch[1]] = value;
          } else if (routeSegment !== uriSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true;
            break;
          }
        }

        if (!missed) {
          match = {
            route,
            params,
            uri: "/" + uriSegments.slice(0, index).join("/")
          };
          break;
        }
      }

      return match || default_ || null;
    }

    /**
     * Check if the `path` matches the `uri`.
     * @param {string} path
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
      return pick([route], uri);
    }

    /**
     * Add the query to the pathname if a query is given
     * @param {string} pathname
     * @param {string} [query]
     * @return {string}
     */
    function addQuery(pathname, query) {
      return pathname + (query ? `?${query}` : "");
    }

    /**
     * Resolve URIs as though every path is a directory, no files. Relative URIs
     * in the browser can feel awkward because not only can you be "in a directory",
     * you can be "at a file", too. For example:
     *
     *  browserSpecResolve('foo', '/bar/') => /bar/foo
     *  browserSpecResolve('foo', '/bar') => /foo
     *
     * But on the command line of a file system, it's not as complicated. You can't
     * `cd` from a file, only directories. This way, links have to know less about
     * their current path. To go deeper you can do this:
     *
     *  <Link to="deeper"/>
     *  // instead of
     *  <Link to=`{${props.uri}/deeper}`/>
     *
     * Just like `cd`, if you want to go deeper from the command line, you do this:
     *
     *  cd deeper
     *  # not
     *  cd $(pwd)/deeper
     *
     * By treating every path as a directory, linking to relative paths should
     * require less contextual information and (fingers crossed) be more intuitive.
     * @param {string} to
     * @param {string} base
     * @return {string}
     */
    function resolve(to, base) {
      // /foo/bar, /baz/qux => /foo/bar
      if (startsWith(to, "/")) {
        return to;
      }

      const [toPathname, toQuery] = to.split("?");
      const [basePathname] = base.split("?");
      const toSegments = segmentize(toPathname);
      const baseSegments = segmentize(basePathname);

      // ?a=b, /users?b=c => /users?a=b
      if (toSegments[0] === "") {
        return addQuery(basePathname, toQuery);
      }

      // profile, /users/789 => /users/789/profile
      if (!startsWith(toSegments[0], ".")) {
        const pathname = baseSegments.concat(toSegments).join("/");

        return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
      }

      // ./       , /users/123 => /users/123
      // ../      , /users/123 => /users
      // ../..    , /users/123 => /
      // ../../one, /a/b/c/d   => /a/b/one
      // .././one , /a/b/c/d   => /a/b/c/one
      const allSegments = baseSegments.concat(toSegments);
      const segments = [];

      allSegments.forEach(segment => {
        if (segment === "..") {
          segments.pop();
        } else if (segment !== ".") {
          segments.push(segment);
        }
      });

      return addQuery("/" + segments.join("/"), toQuery);
    }

    /**
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    /* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.22.3 */

    function create_fragment(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 32768) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $base;
    	let $location;
    	let $routes;
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, "routes");
    	component_subscribe($$self, routes, value => $$invalidate(8, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	validate_store(location, "location");
    	component_subscribe($$self, location, value => $$invalidate(7, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, "base");
    	component_subscribe($$self, base, value => $$invalidate(6, $base = value));

    	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
    		// If there is no activeRoute, the routerBase will be identical to the base.
    		if (activeRoute === null) {
    			return base;
    		}

    		const { path: basepath } = base;
    		const { route, uri } = activeRoute;

    		// Remove the potential /* or /*splatname from
    		// the end of the child Routes relative paths.
    		const path = route.default
    		? basepath
    		: route.path.replace(/\*.*$/, "");

    		return { path, uri };
    	});

    	function registerRoute(route) {
    		const { path: basepath } = $base;
    		let { path } = route;

    		// We store the original path in the _path property so we can reuse
    		// it when the basepath changes. The only thing that matters is that
    		// the route reference is intact, so mutation is fine.
    		route._path = path;

    		route.path = combinePaths(basepath, path);

    		if (typeof window === "undefined") {
    			// In SSR we should set the activeRoute immediately if it is a match.
    			// If there are more Routes being registered after a match is found,
    			// we just skip them.
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				activeRoute.set(matchingRoute);
    				hasActiveRoute = true;
    			}
    		} else {
    			routes.update(rs => {
    				rs.push(route);
    				return rs;
    			});
    		}
    	}

    	function unregisterRoute(route) {
    		routes.update(rs => {
    			const index = rs.indexOf(route);
    			rs.splice(index, 1);
    			return rs;
    		});
    	}

    	if (!locationContext) {
    		// The topmost Router in the tree is responsible for updating
    		// the location store and supplying it through context.
    		onMount(() => {
    			const unlisten = globalHistory.listen(history => {
    				location.set(history.location);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute
    	});

    	const writable_props = ["basepath", "url"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Router", $$slots, ['default']);

    	$$self.$set = $$props => {
    		if ("basepath" in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ("url" in $$props) $$invalidate(4, url = $$props.url);
    		if ("$$scope" in $$props) $$invalidate(15, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		derived,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		pick,
    		match,
    		stripSlashes,
    		combinePaths,
    		basepath,
    		url,
    		locationContext,
    		routerContext,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		location,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$base,
    		$location,
    		$routes
    	});

    	$$self.$inject_state = $$props => {
    		if ("basepath" in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ("url" in $$props) $$invalidate(4, url = $$props.url);
    		if ("hasActiveRoute" in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 64) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			 {
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 384) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			 {
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		hasActiveRoute,
    		$base,
    		$location,
    		$routes,
    		locationContext,
    		routerContext,
    		activeRoute,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$$scope,
    		$$slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.22.3 */

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*routeParams*/ 2,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context = ctx => ({
    	params: /*routeParams*/ ctx[1],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[13].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope, routeParams, $location*/ 4114) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[12], get_default_slot_context), get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, get_default_slot_changes));
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1(ctx) {
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[1],
    		/*routeProps*/ ctx[2]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 22)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 2 && get_spread_object(/*routeParams*/ ctx[1]),
    					dirty & /*routeProps*/ 4 && get_spread_object(/*routeProps*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[3] !== null && /*$activeRoute*/ ctx[3].route === /*route*/ ctx[7] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[3] !== null && /*$activeRoute*/ ctx[3].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, "activeRoute");
    	component_subscribe($$self, activeRoute, value => $$invalidate(3, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, "location");
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

    	const route = {
    		path,
    		// If no path prop is given, this Route will act as the default Route
    		// that is rendered if no other Route in the Router is a match.
    		default: path === ""
    	};

    	let routeParams = {};
    	let routeProps = {};
    	registerRoute(route);

    	// There is no need to unregister Routes in SSR since it will all be
    	// thrown away anyway.
    	if (typeof window !== "undefined") {
    		onDestroy(() => {
    			unregisterRoute(route);
    		});
    	}

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Route", $$slots, ['default']);

    	$$self.$set = $$new_props => {
    		$$invalidate(11, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("path" in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ("component" in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ("$$scope" in $$new_props) $$invalidate(12, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		LOCATION,
    		path,
    		component,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		location,
    		route,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(11, $$props = assign(assign({}, $$props), $$new_props));
    		if ("path" in $$props) $$invalidate(8, path = $$new_props.path);
    		if ("component" in $$props) $$invalidate(0, component = $$new_props.component);
    		if ("routeParams" in $$props) $$invalidate(1, routeParams = $$new_props.routeParams);
    		if ("routeProps" in $$props) $$invalidate(2, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 8) {
    			 if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(1, routeParams = $activeRoute.params);
    			}
    		}

    		 {
    			const { path, component, ...rest } = $$props;
    			$$invalidate(2, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		registerRoute,
    		unregisterRoute,
    		$$props,
    		$$scope,
    		$$slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/svelte-routing/src/Link.svelte generated by Svelte v3.22.3 */
    const file = "node_modules/svelte-routing/src/Link.svelte";

    function create_fragment$2(ctx) {
    	let a;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			set_attributes(a, a_data);
    			add_location(a, file, 40, 0, 1249);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(a, "click", /*onClick*/ ctx[5], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 32768) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
    				}
    			}

    			set_attributes(a, get_spread_update(a_levels, [
    				dirty & /*href*/ 1 && { href: /*href*/ ctx[0] },
    				dirty & /*ariaCurrent*/ 4 && { "aria-current": /*ariaCurrent*/ ctx[2] },
    				dirty & /*props*/ 2 && /*props*/ ctx[1]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $base;
    	let $location;
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	validate_store(base, "base");
    	component_subscribe($$self, base, value => $$invalidate(12, $base = value));
    	const location = getContext(LOCATION);
    	validate_store(location, "location");
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = $location.pathname === href || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	const writable_props = ["to", "replace", "state", "getProps"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Link> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Link", $$slots, ['default']);

    	$$self.$set = $$props => {
    		if ("to" in $$props) $$invalidate(6, to = $$props.to);
    		if ("replace" in $$props) $$invalidate(7, replace = $$props.replace);
    		if ("state" in $$props) $$invalidate(8, state = $$props.state);
    		if ("getProps" in $$props) $$invalidate(9, getProps = $$props.getProps);
    		if ("$$scope" in $$props) $$invalidate(15, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		createEventDispatcher,
    		ROUTER,
    		LOCATION,
    		navigate,
    		startsWith,
    		resolve,
    		shouldNavigate,
    		to,
    		replace,
    		state,
    		getProps,
    		base,
    		location,
    		dispatch,
    		href,
    		isPartiallyCurrent,
    		isCurrent,
    		props,
    		onClick,
    		$base,
    		$location,
    		ariaCurrent
    	});

    	$$self.$inject_state = $$props => {
    		if ("to" in $$props) $$invalidate(6, to = $$props.to);
    		if ("replace" in $$props) $$invalidate(7, replace = $$props.replace);
    		if ("state" in $$props) $$invalidate(8, state = $$props.state);
    		if ("getProps" in $$props) $$invalidate(9, getProps = $$props.getProps);
    		if ("href" in $$props) $$invalidate(0, href = $$props.href);
    		if ("isPartiallyCurrent" in $$props) $$invalidate(10, isPartiallyCurrent = $$props.isPartiallyCurrent);
    		if ("isCurrent" in $$props) $$invalidate(11, isCurrent = $$props.isCurrent);
    		if ("props" in $$props) $$invalidate(1, props = $$props.props);
    		if ("ariaCurrent" in $$props) $$invalidate(2, ariaCurrent = $$props.ariaCurrent);
    	};

    	let ariaCurrent;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 4160) {
    			 $$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			 $$invalidate(10, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			 $$invalidate(11, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 2048) {
    			 $$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 11777) {
    			 $$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$base,
    		$location,
    		dispatch,
    		$$scope,
    		$$slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { to: 6, replace: 7, state: 8, getProps: 9 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/layout/Navbar.svelte generated by Svelte v3.22.3 */
    const file$1 = "src/layout/Navbar.svelte";

    // (10:8) <Link class="uk-navbar-item uk-logo" to="/">
    function create_default_slot_11(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (img.src !== (img_src_value = "https://whimlovestyles.netlify.app/images/FinalWhim-Logo-1024x512.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "id", "Whimlove-Logo");
    			attr_dev(img, "alt", "Whimlove ");
    			attr_dev(img, "sizes", "(max-width: 479px) 71vw, (max-width: 991px) 169.9921875px,\n            17vw");
    			attr_dev(img, "srcset", "https://whimlovestyles.netlify.app/images/FinalWhim-Logo-1024x512-p-500.png\n            500w,\n            https://whimlovestyles.netlify.app/images/FinalWhim-Logo-1024x512-p-800.png\n            800w");
    			attr_dev(img, "class", "image-36");
    			add_location(img, file$1, 10, 10, 243);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_11.name,
    		type: "slot",
    		source: "(10:8) <Link class=\\\"uk-navbar-item uk-logo\\\" to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (26:12) <Link to="/">
    function create_default_slot_10(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Active");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_10.name,
    		type: "slot",
    		source: "(26:12) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (29:12) <Link to="/">
    function create_default_slot_9(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Parent");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_9.name,
    		type: "slot",
    		source: "(29:12) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (33:18) <Link to="/about">
    function create_default_slot_8(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("About");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_8.name,
    		type: "slot",
    		source: "(33:18) <Link to=\\\"/about\\\">",
    		ctx
    	});

    	return block;
    }

    // (36:18) <Link to="/">
    function create_default_slot_7(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Parent");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_7.name,
    		type: "slot",
    		source: "(36:18) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (39:22) <Link to="/">
    function create_default_slot_6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Sub item");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(39:22) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (42:22) <Link to="/">
    function create_default_slot_5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Sub item");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(42:22) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (48:18) <Link to="/">
    function create_default_slot_4(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text("\n                    Item");
    			attr_dev(span, "class", "uk-margin-small-right");
    			attr_dev(span, "uk-icon", "icon: table");
    			add_location(span, file$1, 48, 20, 1652);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(48:18) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (54:18) <Link to="/">
    function create_default_slot_3(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text("\n                    Item");
    			attr_dev(span, "class", "uk-margin-small-right");
    			attr_dev(span, "uk-icon", "icon: thumbnails");
    			add_location(span, file$1, 54, 20, 1859);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(54:18) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (63:18) <Link to="/">
    function create_default_slot_2(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text("\n                    Item");
    			attr_dev(span, "class", "uk-margin-small-right");
    			attr_dev(span, "uk-icon", "icon: trash");
    			add_location(span, file$1, 63, 20, 2161);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(63:18) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (72:12) <Link to="/">
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Item");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(72:12) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (75:12) <Link to="/">
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Item");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(75:12) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let nav;
    	let div7;
    	let div6;
    	let div1;
    	let t0;
    	let ul2;
    	let li0;
    	let t1;
    	let li10;
    	let t2;
    	let div0;
    	let ul1;
    	let li1;
    	let t3;
    	let li4;
    	let t4;
    	let ul0;
    	let li2;
    	let t5;
    	let li3;
    	let t6;
    	let li5;
    	let t8;
    	let li6;
    	let t9;
    	let li7;
    	let t10;
    	let li8;
    	let t11;
    	let li9;
    	let t12;
    	let li11;
    	let t13;
    	let li12;
    	let t14;
    	let div5;
    	let div4;
    	let a;
    	let t16;
    	let div3;
    	let div2;
    	let button;
    	let t17;
    	let h3;
    	let t19;
    	let p;
    	let current;

    	const link0 = new Link({
    			props: {
    				class: "uk-navbar-item uk-logo",
    				to: "/",
    				$$slots: { default: [create_default_slot_11] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link1 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_10] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link2 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_9] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link3 = new Link({
    			props: {
    				to: "/about",
    				$$slots: { default: [create_default_slot_8] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link4 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link5 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link6 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link7 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link8 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link9 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link10 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const link11 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div7 = element("div");
    			div6 = element("div");
    			div1 = element("div");
    			create_component(link0.$$.fragment);
    			t0 = space();
    			ul2 = element("ul");
    			li0 = element("li");
    			create_component(link1.$$.fragment);
    			t1 = space();
    			li10 = element("li");
    			create_component(link2.$$.fragment);
    			t2 = space();
    			div0 = element("div");
    			ul1 = element("ul");
    			li1 = element("li");
    			create_component(link3.$$.fragment);
    			t3 = space();
    			li4 = element("li");
    			create_component(link4.$$.fragment);
    			t4 = space();
    			ul0 = element("ul");
    			li2 = element("li");
    			create_component(link5.$$.fragment);
    			t5 = space();
    			li3 = element("li");
    			create_component(link6.$$.fragment);
    			t6 = space();
    			li5 = element("li");
    			li5.textContent = "Header";
    			t8 = space();
    			li6 = element("li");
    			create_component(link7.$$.fragment);
    			t9 = space();
    			li7 = element("li");
    			create_component(link8.$$.fragment);
    			t10 = space();
    			li8 = element("li");
    			t11 = space();
    			li9 = element("li");
    			create_component(link9.$$.fragment);
    			t12 = space();
    			li11 = element("li");
    			create_component(link10.$$.fragment);
    			t13 = space();
    			li12 = element("li");
    			create_component(link11.$$.fragment);
    			t14 = space();
    			div5 = element("div");
    			div4 = element("div");
    			a = element("a");
    			a.textContent = "Shop";
    			t16 = space();
    			div3 = element("div");
    			div2 = element("div");
    			button = element("button");
    			t17 = space();
    			h3 = element("h3");
    			h3.textContent = "Title";
    			t19 = space();
    			p = element("p");
    			p.textContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do\n                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut\n                enim ad minim veniam, quis nostrud exercitation ullamco laboris\n                nisi ut aliquip ex ea commodo consequat.";
    			attr_dev(li0, "class", "uk-active");
    			add_location(li0, file$1, 24, 10, 805);
    			attr_dev(li1, "class", "uk-active");
    			add_location(li1, file$1, 31, 16, 1055);
    			add_location(li2, file$1, 37, 20, 1295);
    			add_location(li3, file$1, 40, 20, 1397);
    			attr_dev(ul0, "class", "uk-nav-sub");
    			add_location(ul0, file$1, 36, 18, 1251);
    			attr_dev(li4, "class", "uk-parent");
    			add_location(li4, file$1, 34, 16, 1165);
    			attr_dev(li5, "class", "uk-nav-header");
    			add_location(li5, file$1, 45, 16, 1541);
    			add_location(li6, file$1, 46, 16, 1595);
    			add_location(li7, file$1, 52, 16, 1802);
    			attr_dev(li8, "class", "uk-nav-divider");
    			add_location(li8, file$1, 60, 16, 2058);
    			add_location(li9, file$1, 61, 16, 2104);
    			attr_dev(ul1, "class", "uk-nav uk-navbar-dropdown-nav");
    			add_location(ul1, file$1, 30, 14, 996);
    			attr_dev(div0, "class", "uk-navbar-dropdown");
    			add_location(div0, file$1, 29, 12, 949);
    			add_location(li10, file$1, 27, 10, 893);
    			add_location(li11, file$1, 70, 10, 2360);
    			add_location(li12, file$1, 73, 10, 2428);
    			attr_dev(ul2, "class", "uk-navbar-nav");
    			add_location(ul2, file$1, 23, 8, 768);
    			attr_dev(div1, "class", "uk-navbar-left");
    			add_location(div1, file$1, 7, 6, 150);
    			attr_dev(a, "href", "#offcanvas-usage");
    			attr_dev(a, "uk-toggle", "");
    			add_location(a, file$1, 82, 10, 2597);
    			attr_dev(button, "class", "uk-offcanvas-close");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "uk-close", "");
    			add_location(button, file$1, 87, 14, 2752);
    			add_location(h3, file$1, 89, 14, 2828);
    			add_location(p, file$1, 91, 14, 2858);
    			attr_dev(div2, "class", "uk-offcanvas-bar");
    			add_location(div2, file$1, 85, 12, 2706);
    			attr_dev(div3, "id", "offcanvas-usage");
    			attr_dev(div3, "uk-offcanvas", "");
    			add_location(div3, file$1, 84, 10, 2654);
    			attr_dev(div4, "class", "uk-margin-top");
    			add_location(div4, file$1, 80, 8, 2558);
    			attr_dev(div5, "class", "uk-navbar-right");
    			add_location(div5, file$1, 79, 6, 2520);
    			attr_dev(div6, "uk-navbar", "");
    			add_location(div6, file$1, 6, 4, 128);
    			attr_dev(div7, "class", "uk-container");
    			add_location(div7, file$1, 5, 2, 97);
    			attr_dev(nav, "class", "uk-navbar-container");
    			add_location(nav, file$1, 4, 0, 61);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div7);
    			append_dev(div7, div6);
    			append_dev(div6, div1);
    			mount_component(link0, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, ul2);
    			append_dev(ul2, li0);
    			mount_component(link1, li0, null);
    			append_dev(ul2, t1);
    			append_dev(ul2, li10);
    			mount_component(link2, li10, null);
    			append_dev(li10, t2);
    			append_dev(li10, div0);
    			append_dev(div0, ul1);
    			append_dev(ul1, li1);
    			mount_component(link3, li1, null);
    			append_dev(ul1, t3);
    			append_dev(ul1, li4);
    			mount_component(link4, li4, null);
    			append_dev(li4, t4);
    			append_dev(li4, ul0);
    			append_dev(ul0, li2);
    			mount_component(link5, li2, null);
    			append_dev(ul0, t5);
    			append_dev(ul0, li3);
    			mount_component(link6, li3, null);
    			append_dev(ul1, t6);
    			append_dev(ul1, li5);
    			append_dev(ul1, t8);
    			append_dev(ul1, li6);
    			mount_component(link7, li6, null);
    			append_dev(ul1, t9);
    			append_dev(ul1, li7);
    			mount_component(link8, li7, null);
    			append_dev(ul1, t10);
    			append_dev(ul1, li8);
    			append_dev(ul1, t11);
    			append_dev(ul1, li9);
    			mount_component(link9, li9, null);
    			append_dev(ul2, t12);
    			append_dev(ul2, li11);
    			mount_component(link10, li11, null);
    			append_dev(ul2, t13);
    			append_dev(ul2, li12);
    			mount_component(link11, li12, null);
    			append_dev(div6, t14);
    			append_dev(div6, div5);
    			append_dev(div5, div4);
    			append_dev(div4, a);
    			append_dev(div4, t16);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, button);
    			append_dev(div2, t17);
    			append_dev(div2, h3);
    			append_dev(div2, t19);
    			append_dev(div2, p);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const link0_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link0_changes.$$scope = { dirty, ctx };
    			}

    			link0.$set(link0_changes);
    			const link1_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link1_changes.$$scope = { dirty, ctx };
    			}

    			link1.$set(link1_changes);
    			const link2_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link2_changes.$$scope = { dirty, ctx };
    			}

    			link2.$set(link2_changes);
    			const link3_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link3_changes.$$scope = { dirty, ctx };
    			}

    			link3.$set(link3_changes);
    			const link4_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link4_changes.$$scope = { dirty, ctx };
    			}

    			link4.$set(link4_changes);
    			const link5_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link5_changes.$$scope = { dirty, ctx };
    			}

    			link5.$set(link5_changes);
    			const link6_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link6_changes.$$scope = { dirty, ctx };
    			}

    			link6.$set(link6_changes);
    			const link7_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link7_changes.$$scope = { dirty, ctx };
    			}

    			link7.$set(link7_changes);
    			const link8_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link8_changes.$$scope = { dirty, ctx };
    			}

    			link8.$set(link8_changes);
    			const link9_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link9_changes.$$scope = { dirty, ctx };
    			}

    			link9.$set(link9_changes);
    			const link10_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link10_changes.$$scope = { dirty, ctx };
    			}

    			link10.$set(link10_changes);
    			const link11_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				link11_changes.$$scope = { dirty, ctx };
    			}

    			link11.$set(link11_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link0.$$.fragment, local);
    			transition_in(link1.$$.fragment, local);
    			transition_in(link2.$$.fragment, local);
    			transition_in(link3.$$.fragment, local);
    			transition_in(link4.$$.fragment, local);
    			transition_in(link5.$$.fragment, local);
    			transition_in(link6.$$.fragment, local);
    			transition_in(link7.$$.fragment, local);
    			transition_in(link8.$$.fragment, local);
    			transition_in(link9.$$.fragment, local);
    			transition_in(link10.$$.fragment, local);
    			transition_in(link11.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link0.$$.fragment, local);
    			transition_out(link1.$$.fragment, local);
    			transition_out(link2.$$.fragment, local);
    			transition_out(link3.$$.fragment, local);
    			transition_out(link4.$$.fragment, local);
    			transition_out(link5.$$.fragment, local);
    			transition_out(link6.$$.fragment, local);
    			transition_out(link7.$$.fragment, local);
    			transition_out(link8.$$.fragment, local);
    			transition_out(link9.$$.fragment, local);
    			transition_out(link10.$$.fragment, local);
    			transition_out(link11.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			destroy_component(link0);
    			destroy_component(link1);
    			destroy_component(link2);
    			destroy_component(link3);
    			destroy_component(link4);
    			destroy_component(link5);
    			destroy_component(link6);
    			destroy_component(link7);
    			destroy_component(link8);
    			destroy_component(link9);
    			destroy_component(link10);
    			destroy_component(link11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Navbar", $$slots, []);
    	$$self.$capture_state = () => ({ Link });
    	return [];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/pages/Home.svelte generated by Svelte v3.22.3 */
    const file$2 = "src/pages/Home.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (130:2) {:else}
    function create_else_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "loading...";
    			add_location(p, file$2, 131, 4, 3329);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(130:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (125:2) {#each photos as photo}
    function create_each_block(ctx) {
    	let figure;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let figcaption;
    	let t1_value = /*photo*/ ctx[1].title + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			figure = element("figure");
    			img = element("img");
    			t0 = space();
    			figcaption = element("figcaption");
    			t1 = text(t1_value);
    			t2 = space();
    			if (img.src !== (img_src_value = /*photo*/ ctx[1].thumbnailUrl)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*photo*/ ctx[1].title);
    			attr_dev(img, "class", "svelte-1xibmtz");
    			add_location(img, file$2, 126, 6, 3148);
    			add_location(figcaption, file$2, 127, 6, 3205);
    			attr_dev(figure, "class", "svelte-1xibmtz");
    			add_location(figure, file$2, 125, 4, 3133);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, figure, anchor);
    			append_dev(figure, img);
    			append_dev(figure, t0);
    			append_dev(figure, figcaption);
    			append_dev(figcaption, t1);
    			append_dev(figure, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*photos*/ 1 && img.src !== (img_src_value = /*photo*/ ctx[1].thumbnailUrl)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*photos*/ 1 && img_alt_value !== (img_alt_value = /*photo*/ ctx[1].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*photos*/ 1 && t1_value !== (t1_value = /*photo*/ ctx[1].title + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(figure);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(125:2) {#each photos as photo}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div0;
    	let t0;
    	let div13;
    	let ul;
    	let li0;
    	let div3;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let div2;
    	let h10;
    	let t3;
    	let div1;
    	let a0;
    	let t5;
    	let li1;
    	let div5;
    	let img1;
    	let img1_src_value;
    	let t6;
    	let div4;
    	let h11;
    	let t8;
    	let li2;
    	let div7;
    	let img2;
    	let img2_src_value;
    	let t9;
    	let div6;
    	let h3;
    	let t11;
    	let li3;
    	let div9;
    	let img3;
    	let img3_src_value;
    	let t12;
    	let div8;
    	let h12;
    	let t14;
    	let li4;
    	let div12;
    	let img4;
    	let img4_src_value;
    	let t15;
    	let div11;
    	let h13;
    	let t17;
    	let div10;
    	let a1;
    	let t19;
    	let a2;
    	let t20;
    	let a3;
    	let t21;
    	let h14;
    	let t23;
    	let div14;
    	let each_value = /*photos*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block$1(ctx);
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div13 = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			div3 = element("div");
    			img0 = element("img");
    			t1 = space();
    			div2 = element("div");
    			h10 = element("h1");
    			h10.textContent = "this is a lightbox";
    			t3 = space();
    			div1 = element("div");
    			a0 = element("a");
    			a0.textContent = "Create Style Boards";
    			t5 = space();
    			li1 = element("li");
    			div5 = element("div");
    			img1 = element("img");
    			t6 = space();
    			div4 = element("div");
    			h11 = element("h1");
    			h11.textContent = "x-large";
    			t8 = space();
    			li2 = element("li");
    			div7 = element("div");
    			img2 = element("img");
    			t9 = space();
    			div6 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Title sample custom fonts";
    			t11 = space();
    			li3 = element("li");
    			div9 = element("div");
    			img3 = element("img");
    			t12 = space();
    			div8 = element("div");
    			h12 = element("h1");
    			h12.textContent = "4";
    			t14 = space();
    			li4 = element("li");
    			div12 = element("div");
    			img4 = element("img");
    			t15 = space();
    			div11 = element("div");
    			h13 = element("h1");
    			h13.textContent = "this is a lightbox";
    			t17 = space();
    			div10 = element("div");
    			a1 = element("a");
    			a1.textContent = "Create Style Boards";
    			t19 = space();
    			a2 = element("a");
    			t20 = space();
    			a3 = element("a");
    			t21 = space();
    			h14 = element("h1");
    			h14.textContent = "shop collections";
    			t23 = space();
    			div14 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			attr_dev(div0, "class", "uk-margin-top");
    			add_location(div0, file$2, 28, 0, 423);
    			if (img0.src !== (img0_src_value = "https://whimlovestyles.netlify.app/images/trio2-p-1080.jpeg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			attr_dev(img0, "class", "svelte-1xibmtz");
    			add_location(img0, file$2, 36, 8, 667);
    			attr_dev(h10, "class", "bohemian");
    			add_location(h10, file$2, 40, 10, 828);
    			attr_dev(a0, "class", "uk-button uk-button-secondary");
    			attr_dev(a0, "href", "https://whimlovedressingroom.netlify.app/");
    			attr_dev(a0, "data-caption", "Instructions");
    			attr_dev(a0, "data-type", "iframe");
    			add_location(a0, file$2, 44, 12, 915);
    			attr_dev(div1, "uk-lightbox", "");
    			add_location(div1, file$2, 42, 10, 884);
    			attr_dev(div2, "class", "uk-position-center uk-panel");
    			add_location(div2, file$2, 39, 8, 776);
    			attr_dev(div3, "class", "uk-panel");
    			add_location(div3, file$2, 35, 6, 636);
    			attr_dev(li0, "class", "uk-width-3-4");
    			add_location(li0, file$2, 34, 4, 604);
    			if (img1.src !== (img1_src_value = "https://whimlovestyles.netlify.app/images/trio2-p-1080.jpeg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "class", "svelte-1xibmtz");
    			add_location(img1, file$2, 57, 8, 1282);
    			attr_dev(h11, "class", "uk-heading-2xlarge");
    			add_location(h11, file$2, 61, 10, 1443);
    			attr_dev(div4, "class", "uk-position-center uk-panel");
    			add_location(div4, file$2, 60, 8, 1391);
    			attr_dev(div5, "class", "uk-panel");
    			add_location(div5, file$2, 56, 6, 1251);
    			attr_dev(li1, "class", "uk-width-3-4");
    			add_location(li1, file$2, 55, 4, 1219);
    			if (img2.src !== (img2_src_value = "https://whimlovestyles.netlify.app/images/trio2-p-1080.jpeg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			attr_dev(img2, "class", "svelte-1xibmtz");
    			add_location(img2, file$2, 67, 8, 1592);
    			attr_dev(h3, "class", "bohemian");
    			add_location(h3, file$2, 71, 10, 1753);
    			attr_dev(div6, "class", "uk-position-center uk-panel");
    			add_location(div6, file$2, 70, 8, 1701);
    			attr_dev(div7, "class", "uk-panel");
    			add_location(div7, file$2, 66, 6, 1561);
    			attr_dev(li2, "class", "uk-width-3-4");
    			add_location(li2, file$2, 65, 4, 1529);
    			if (img3.src !== (img3_src_value = "https://whimlovestyles.netlify.app/images/trio2-p-1080.jpeg")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "");
    			attr_dev(img3, "class", "svelte-1xibmtz");
    			add_location(img3, file$2, 77, 8, 1910);
    			add_location(h12, file$2, 81, 10, 2071);
    			attr_dev(div8, "class", "uk-position-center uk-panel");
    			add_location(div8, file$2, 80, 8, 2019);
    			attr_dev(div9, "class", "uk-panel");
    			add_location(div9, file$2, 76, 6, 1879);
    			attr_dev(li3, "class", "uk-width-3-4");
    			add_location(li3, file$2, 75, 4, 1847);
    			if (img4.src !== (img4_src_value = "https://whimlovestyles.netlify.app/images/trio2-p-1080.jpeg")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "");
    			attr_dev(img4, "class", "svelte-1xibmtz");
    			add_location(img4, file$2, 87, 8, 2187);
    			attr_dev(h13, "class", "bohemian");
    			add_location(h13, file$2, 91, 10, 2348);
    			attr_dev(a1, "class", "uk-button uk-button-secondary");
    			attr_dev(a1, "href", "https://whimlovedressingroom.netlify.app/");
    			attr_dev(a1, "data-caption", "Instructions");
    			attr_dev(a1, "data-type", "iframe");
    			add_location(a1, file$2, 95, 12, 2435);
    			attr_dev(div10, "uk-lightbox", "");
    			add_location(div10, file$2, 93, 10, 2404);
    			attr_dev(div11, "class", "uk-position-center uk-panel");
    			add_location(div11, file$2, 90, 8, 2296);
    			attr_dev(div12, "class", "uk-panel");
    			add_location(div12, file$2, 86, 6, 2156);
    			attr_dev(li4, "class", "uk-width-3-4");
    			add_location(li4, file$2, 85, 4, 2124);
    			attr_dev(ul, "class", "uk-slider-items uk-grid");
    			add_location(ul, file$2, 33, 2, 563);
    			attr_dev(a2, "class", "uk-position-center-left uk-position-small uk-hidden-hover");
    			attr_dev(a2, "href", "#");
    			attr_dev(a2, "uk-slidenav-previous", "");
    			attr_dev(a2, "uk-slider-item", "previous");
    			add_location(a2, file$2, 108, 2, 2746);
    			attr_dev(a3, "class", "uk-position-center-right uk-position-small uk-hidden-hover");
    			attr_dev(a3, "href", "#");
    			attr_dev(a3, "uk-slidenav-next", "");
    			attr_dev(a3, "uk-slider-item", "next");
    			add_location(a3, file$2, 113, 2, 2892);
    			attr_dev(div13, "class", "uk-position-relative uk-visible-toggle uk-light ");
    			attr_dev(div13, "tabindex", "-1");
    			attr_dev(div13, "uk-slider", "center: true");
    			add_location(div13, file$2, 29, 0, 453);
    			attr_dev(h14, "class", "bohemian");
    			add_location(h14, file$2, 121, 0, 3038);
    			attr_dev(div14, "class", "photos svelte-1xibmtz");
    			add_location(div14, file$2, 123, 0, 3082);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div13, anchor);
    			append_dev(div13, ul);
    			append_dev(ul, li0);
    			append_dev(li0, div3);
    			append_dev(div3, img0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, h10);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, a0);
    			append_dev(ul, t5);
    			append_dev(ul, li1);
    			append_dev(li1, div5);
    			append_dev(div5, img1);
    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div4, h11);
    			append_dev(ul, t8);
    			append_dev(ul, li2);
    			append_dev(li2, div7);
    			append_dev(div7, img2);
    			append_dev(div7, t9);
    			append_dev(div7, div6);
    			append_dev(div6, h3);
    			append_dev(ul, t11);
    			append_dev(ul, li3);
    			append_dev(li3, div9);
    			append_dev(div9, img3);
    			append_dev(div9, t12);
    			append_dev(div9, div8);
    			append_dev(div8, h12);
    			append_dev(ul, t14);
    			append_dev(ul, li4);
    			append_dev(li4, div12);
    			append_dev(div12, img4);
    			append_dev(div12, t15);
    			append_dev(div12, div11);
    			append_dev(div11, h13);
    			append_dev(div11, t17);
    			append_dev(div11, div10);
    			append_dev(div10, a1);
    			append_dev(div13, t19);
    			append_dev(div13, a2);
    			append_dev(div13, t20);
    			append_dev(div13, a3);
    			insert_dev(target, t21, anchor);
    			insert_dev(target, h14, anchor);
    			insert_dev(target, t23, anchor);
    			insert_dev(target, div14, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div14, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div14, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*photos*/ 1) {
    				each_value = /*photos*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div14, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block$1(ctx);
    					each_1_else.c();
    					each_1_else.m(div14, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div13);
    			if (detaching) detach_dev(t21);
    			if (detaching) detach_dev(h14);
    			if (detaching) detach_dev(t23);
    			if (detaching) detach_dev(div14);
    			destroy_each(each_blocks, detaching);
    			if (each_1_else) each_1_else.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let photos = [];

    	onMount(async () => {
    		const res = await fetch(`https://jsonplaceholder.typicode.com/photos?_limit=20`);
    		$$invalidate(0, photos = await res.json());
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Home", $$slots, []);
    	$$self.$capture_state = () => ({ onMount, photos });

    	$$self.$inject_state = $$props => {
    		if ("photos" in $$props) $$invalidate(0, photos = $$props.photos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [photos];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/pages/About.svelte generated by Svelte v3.22.3 */

    const file$3 = "src/pages/About.svelte";

    function create_fragment$5(ctx) {
    	let div14;
    	let div13;
    	let div3;
    	let div2;
    	let div0;
    	let span0;
    	let t1;
    	let div1;
    	let span1;
    	let t2;
    	let t3;
    	let div6;
    	let div5;
    	let img;
    	let img_src_value;
    	let t4;
    	let div4;
    	let span2;
    	let t5;
    	let span3;
    	let t6;
    	let t7;
    	let div7;
    	let h6;
    	let t9;
    	let p;
    	let t11;
    	let div12;
    	let div11;
    	let div8;
    	let t13;
    	let div9;
    	let a0;
    	let t14;
    	let a1;
    	let t15;
    	let a2;
    	let t16;
    	let a3;
    	let t17;
    	let div10;
    	let a4;

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			div13 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "Design";
    			t1 = space();
    			div1 = element("div");
    			span1 = element("span");
    			t2 = text("\n          4 days.");
    			t3 = space();
    			div6 = element("div");
    			div5 = element("div");
    			img = element("img");
    			t4 = space();
    			div4 = element("div");
    			span2 = element("span");
    			t5 = text("\n          12.345\n          ");
    			span3 = element("span");
    			t6 = text("\n          12.345");
    			t7 = space();
    			div7 = element("div");
    			h6 = element("h6");
    			h6.textContent = "HOW TO CREATE CUSTOM COLOR PALETTE";
    			t9 = space();
    			p = element("p");
    			p.textContent = "Duis aute irure dolor in reprehenderit in voluptate velit";
    			t11 = space();
    			div12 = element("div");
    			div11 = element("div");
    			div8 = element("div");
    			div8.textContent = "John Doe";
    			t13 = space();
    			div9 = element("div");
    			a0 = element("a");
    			t14 = space();
    			a1 = element("a");
    			t15 = space();
    			a2 = element("a");
    			t16 = space();
    			a3 = element("a");
    			t17 = space();
    			div10 = element("div");
    			a4 = element("a");
    			attr_dev(span0, "class", "cat-txt");
    			add_location(span0, file$3, 8, 10, 306);
    			attr_dev(div0, "class", "uk-width-expand");
    			add_location(div0, file$3, 7, 8, 266);
    			attr_dev(span1, "data-uk-icon", "icon:clock; ratio: 0.8");
    			add_location(span1, file$3, 11, 10, 431);
    			attr_dev(div1, "class", "uk-width-auto uk-text-right uk-text-muted");
    			add_location(div1, file$3, 10, 8, 365);
    			attr_dev(div2, "class", "uk-grid uk-grid-small uk-text-small");
    			attr_dev(div2, "data-uk-grid", "");
    			add_location(div2, file$3, 6, 6, 195);
    			attr_dev(div3, "class", "uk-card-header");
    			add_location(div3, file$3, 5, 4, 160);
    			attr_dev(img, "class", "lazy");
    			attr_dev(img, "data-src", "https://picsum.photos/400/180/?random=2");
    			attr_dev(img, "data-width", "400");
    			attr_dev(img, "data-height", "180");
    			attr_dev(img, "data-uk-img", "");
    			attr_dev(img, "alt", "");
    			if (img.src !== (img_src_value = "img/transp.gif")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$3, 18, 8, 644);
    			attr_dev(span2, "data-uk-icon", "icon:heart; ratio: 0.8");
    			add_location(span2, file$3, 29, 10, 989);
    			attr_dev(span3, "data-uk-icon", "icon:comment; ratio: 0.8");
    			add_location(span3, file$3, 31, 10, 1063);
    			attr_dev(div4, "class", "uk-transition-slide-bottom uk-position-bottom uk-overlay\n          uk-overlay-primary");
    			add_location(div4, file$3, 26, 8, 869);
    			attr_dev(div5, "class", "uk-inline-clip uk-transition-toggle");
    			attr_dev(div5, "tabindex", "0");
    			add_location(div5, file$3, 17, 6, 573);
    			attr_dev(div6, "class", "uk-card-media");
    			add_location(div6, file$3, 16, 4, 539);
    			attr_dev(h6, "class", "uk-margin-small-bottom uk-margin-remove-adjacent uk-text-bold");
    			add_location(h6, file$3, 38, 6, 1206);
    			attr_dev(p, "class", "uk-text-small uk-text-muted");
    			add_location(p, file$3, 41, 6, 1342);
    			attr_dev(div7, "class", "uk-card-body");
    			add_location(div7, file$3, 37, 4, 1173);
    			attr_dev(div8, "class", "uk-width-expand uk-text-small");
    			add_location(div8, file$3, 49, 8, 1621);
    			attr_dev(a0, "href", "#");
    			attr_dev(a0, "data-uk-tooltip", "title: Twitter");
    			attr_dev(a0, "class", "uk-icon-link");
    			attr_dev(a0, "data-uk-icon", "icon:twitter; ratio: 0.8");
    			add_location(a0, file$3, 51, 10, 1739);
    			attr_dev(a1, "href", "#");
    			attr_dev(a1, "data-uk-tooltip", "title: Instagram");
    			attr_dev(a1, "class", "uk-icon-link");
    			attr_dev(a1, "data-uk-icon", "icon:instagram; ratio: 0.8");
    			add_location(a1, file$3, 56, 10, 1906);
    			attr_dev(a2, "href", "#");
    			attr_dev(a2, "data-uk-tooltip", "title: Behance");
    			attr_dev(a2, "class", "uk-icon-link");
    			attr_dev(a2, "data-uk-icon", "icon:behance; ratio: 0.8");
    			add_location(a2, file$3, 61, 10, 2077);
    			attr_dev(a3, "href", "#");
    			attr_dev(a3, "data-uk-tooltip", "title: Pinterest");
    			attr_dev(a3, "class", "uk-icon-link");
    			attr_dev(a3, "data-uk-icon", "icon:pinterest; ratio: 0.8");
    			add_location(a3, file$3, 66, 10, 2244);
    			attr_dev(div9, "class", "uk-width-auto uk-text-right");
    			add_location(div9, file$3, 50, 8, 1687);
    			attr_dev(a4, "data-uk-tooltip", "title: Drag this card");
    			attr_dev(a4, "href", "#");
    			attr_dev(a4, "class", "uk-icon-link drag-icon");
    			attr_dev(a4, "data-uk-icon", "icon:move; ratio: 1");
    			add_location(a4, file$3, 73, 10, 2480);
    			attr_dev(div10, "class", "uk-width-auto uk-text-right");
    			add_location(div10, file$3, 72, 8, 2428);
    			attr_dev(div11, "class", "uk-grid uk-grid-small uk-grid-divider uk-flex uk-flex-middle");
    			attr_dev(div11, "data-uk-grid", "");
    			add_location(div11, file$3, 46, 6, 1509);
    			attr_dev(div12, "class", "uk-card-footer");
    			add_location(div12, file$3, 45, 4, 1474);
    			attr_dev(div13, "class", "uk-card uk-card-small uk-card-default");
    			add_location(div13, file$3, 4, 2, 104);
    			attr_dev(div14, "class", "design-card");
    			attr_dev(div14, "data-tags", "how to create a custom color palette - design");
    			add_location(div14, file$3, 1, 0, 14);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div14, anchor);
    			append_dev(div14, div13);
    			append_dev(div13, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, span1);
    			append_dev(div1, t2);
    			append_dev(div13, t3);
    			append_dev(div13, div6);
    			append_dev(div6, div5);
    			append_dev(div5, img);
    			append_dev(div5, t4);
    			append_dev(div5, div4);
    			append_dev(div4, span2);
    			append_dev(div4, t5);
    			append_dev(div4, span3);
    			append_dev(div4, t6);
    			append_dev(div13, t7);
    			append_dev(div13, div7);
    			append_dev(div7, h6);
    			append_dev(div7, t9);
    			append_dev(div7, p);
    			append_dev(div13, t11);
    			append_dev(div13, div12);
    			append_dev(div12, div11);
    			append_dev(div11, div8);
    			append_dev(div11, t13);
    			append_dev(div11, div9);
    			append_dev(div9, a0);
    			append_dev(div9, t14);
    			append_dev(div9, a1);
    			append_dev(div9, t15);
    			append_dev(div9, a2);
    			append_dev(div9, t16);
    			append_dev(div9, a3);
    			append_dev(div11, t17);
    			append_dev(div11, div10);
    			append_dev(div10, a4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("About", $$slots, []);
    	return [];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.22.3 */
    const file$4 = "src/App.svelte";

    // (16:0) <Router>
    function create_default_slot$1(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let current;
    	const navbar = new Navbar({ $$inline: true });

    	const route0 = new Route({
    			props: { path: "/", component: Home },
    			$$inline: true
    		});

    	const route1 = new Route({
    			props: { path: "/About", component: About },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t0 = space();
    			div = element("div");
    			create_component(route0.$$.fragment);
    			t1 = space();
    			create_component(route1.$$.fragment);
    			attr_dev(div, "class", "uk-container");
    			add_location(div, file$4, 17, 2, 369);
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(route0, div, null);
    			append_dev(div, t1);
    			mount_component(route1, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			destroy_component(route0);
    			destroy_component(route1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(16:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let current;

    	const router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ Router, Link, Route, Navbar, Home, About });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
