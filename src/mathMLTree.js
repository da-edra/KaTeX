// @flow
/**
 * These objects store data about MathML nodes. This is the MathML equivalent
 * of the types in domTree.js. Since MathML handles its own rendering, and
 * since we're mainly using MathML to improve accessibility, we don't manage
 * any of the styling state that the plain DOM nodes do.
 *
 * The `toNode` and `toMarkup` functions work simlarly to how they do in
 * domTree.js, creating namespaced DOM nodes and HTML text markup respectively.
 */

import utils from "./utils";
import {DocumentFragment} from "./tree";

import type {VirtualNode} from "./tree";

/**
 * MathML node types used in KaTeX. For a complete list of MathML nodes, see
 * https://developer.mozilla.org/en-US/docs/Web/MathML/Element.
 */
export type MathNodeType =
    "math" | "annotation" | "semantics" |
    "mtext" | "mn" | "mo" | "mi" | "mspace" |
    "mover" | "munder" | "munderover" | "msup" | "msub" | "msubsup" |
    "mfrac" | "mroot" | "msqrt" |
    "mtable" | "mtr" | "mtd" | "mlabeledtr" |
    "mrow" | "menclose" |
    "mstyle" | "mpadded" | "mphantom" | "mglyph";

export interface MathDomNode extends VirtualNode {
    toText(): string;
}

export type documentFragment = DocumentFragment<MathDomNode>;
export function newDocumentFragment(children: MathDomNode[]): documentFragment {
    return new DocumentFragment(children);
}

/**
 * This node represents a general purpose MathML node of any type. The
 * constructor requires the type of node to create (for example, `"mo"` or
 * `"mspace"`, corresponding to `<mo>` and `<mspace>` tags).
 */
export class MathNode implements MathDomNode {
    type: MathNodeType;
    attributes: {[string]: string};
    children: MathDomNode[];

    constructor(type: MathNodeType, children?: MathDomNode[]) {
        this.type = type;
        this.attributes = {};
        this.children = children || [];
    }

    /**
     * Sets an attribute on a MathML node. MathML depends on attributes to convey a
     * semantic content, so this is used heavily.
     */
    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    /**
     * Gets an attribute on a MathML node.
     */
    getAttribute(name: string): string {
        return this.attributes[name];
    }

    /**
     * Converts the math node into a MathML-namespaced DOM element.
     */
    toNode(): Node {
        const node = document.createElementNS(
            "http://www.w3.org/1998/Math/MathML", this.type);

        for (const attr in this.attributes) {
            if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
                node.setAttribute(attr, this.attributes[attr]);
            }
        }

        for (let i = 0; i < this.children.length; i++) {
            node.appendChild(this.children[i].toNode());
        }

        return node;
    }

    /**
     * Converts the math node into an HTML markup string.
     */
    toMarkup(): string {
        let markup = "<" + this.type;

        // Add the attributes
        for (const attr in this.attributes) {
            if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
                markup += " " + attr + "=\"";
                markup += utils.escape(this.attributes[attr]);
                markup += "\"";
            }
        }

        markup += ">";

        for (let i = 0; i < this.children.length; i++) {
            markup += this.children[i].toMarkup();
        }

        markup += "</" + this.type + ">";

        return markup;
    }

    /**
     * Converts the math node into a string, similar to innerText, but escaped.
     */
    toText(): string {
        return this.children.map(child => child.toText()).join("");
    }
}

/**
 * This node represents a piece of text.
 */
export class TextNode implements MathDomNode {
    text: string;
    needsEscape: boolean;

    constructor(text: string, needsEscape: boolean = true) {
        this.text = text;
        this.needsEscape = needsEscape;
    }

    /**
     * Converts the text node into a DOM text node.
     */
    toNode(): Node {
        return document.createTextNode(this.toText());
    }

    /**
     * Converts the text node into escaped HTML markup
     * (representing the text itself).
     */
    toMarkup(): string {
        return this.toText();
    }

    /**
     * Converts the text node into an escaped string
     * (representing the text iteself).
     */
    toText(): string {
        return this.needsEscape ? utils.escape(this.text) : this.text;
    }
}

/**
 * This node represents a space, but may render as <mspace.../> or as text,
 * depending on the width.
 */
class SpaceNode implements MathDomNode {
    width: number;
    character: ?string;

    /**
     * Create a Space node with width given in CSS ems.
     */
    constructor(width: number) {
        this.width = width;
        // See https://www.w3.org/TR/2000/WD-MathML2-20000328/chapter6.html
        // for a table of space-like characters.  We consistently use the
        // &LongNames; because Unicode does not have single characters for
        // &ThickSpace; (\u2005\u200a) and all negative spaces.
        if (width >= 0.05555 && width <= 0.05556) {
            this.character = "&VeryThinSpace;";  // \u200a
        } else if (width >= 0.1666 && width <= 0.1667) {
            this.character = "&ThinSpace;";      // \u2009
        } else if (width >= 0.2222 && width <= 0.2223) {
            this.character = "&MediumSpace;";    // \u2005
        } else if (width >= 0.2777 && width <= 0.2778) {
            this.character = "&ThickSpace;";     // \u2005\u200a
        } else if (width >= -0.05556 && width <= -0.05555) {
            this.character = "&NegativeVeryThinSpace;";
        } else if (width >= -0.1667 && width <= -0.1666) {
            this.character = "&NegativeThinSpace;";
        } else if (width >= -0.2223 && width <= -0.2222) {
            this.character = "&NegativeMediumSpace;";
        } else if (width >= -0.2778 && width <= -0.2777) {
            this.character = "&NegativeThickSpace;";
        } else {
            this.character = null;
        }
    }

    /**
     * Converts the math node into a MathML-namespaced DOM element.
     */
    toNode(): Node {
        if (this.character) {
            return document.createTextNode(this.character);
        } else {
            const node = document.createElementNS(
                "http://www.w3.org/1998/Math/MathML", "mspace");
            node.setAttribute("width", this.width + "em");
            return node;
        }
    }

    /**
     * Converts the math node into an HTML markup string.
     */
    toMarkup(): string {
        if (this.character) {
            return `<mtext>${this.character}</mtext>`;
        } else {
            return `<mspace width="${this.width}em"/>`;
        }
    }

    /**
     * Converts the math node into a string, similar to innerText.
     */
    toText(): string {
        if (this.character) {
            return this.character;
        } else {
            return " ";
        }
    }
}

export default {
    MathNode,
    TextNode,
    SpaceNode,
    newDocumentFragment,
};
