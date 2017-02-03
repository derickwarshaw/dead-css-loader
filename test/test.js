/* global describe, it */
require("should");
const test = require("./helpers");

describe("DeadCSSLoader", () => {
    it("should remove unused selectors from imported css", () =>
        test("cases/test1.js", "cases/test1.css", "cases/expected1.css")
    );
});
