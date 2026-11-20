import { describe, expect, it } from "vitest";

import {
  COMMENT_BLOCKED_MESSAGE,
  COMMENT_LIMIT_MESSAGE,
  COMMENT_MAX,
  commentActions,
  commentCountLabel,
  commentErrorMessage,
  commentSnippet,
  commentsRowLabel,
  commentToSend,
  readCommentCount,
  withoutAuthor,
} from "./social-comments";

describe("commentErrorMessage", () => {
  it("puts the blocklist and the rate limit in the app's words", () => {
    expect(commentErrorMessage({ code: "23514", message: "x" })).toBe(COMMENT_BLOCKED_MESSAGE);
    expect(commentErrorMessage({ code: "54000", message: "x" })).toBe(COMMENT_LIMIT_MESSAGE);
    expect(COMMENT_BLOCKED_MESSAGE).toBe("Keep it friendly. That comment has words we don't allow.");
    expect(COMMENT_LIMIT_MESSAGE).toBe("You're commenting a lot. Try again in a bit.");
  });

  it("passes anything else through", () => {
    expect(commentErrorMessage({ code: "42501", message: "You can't comment on this workout." })).toBe(
      "You can't comment on this workout.",
    );
    expect(commentErrorMessage({ message: "Could not reach LiftCamp." })).toBe("Could not reach LiftCamp.");
  });
});

describe("commentToSend", () => {
  it("trims, and refuses empty or too long", () => {
    expect(commentToSend("  nice  ")).toBe("nice");
    expect(commentToSend("   ")).toBeNull();
    expect(commentToSend("a".repeat(COMMENT_MAX))).toHaveLength(COMMENT_MAX);
    expect(commentToSend("a".repeat(COMMENT_MAX + 1))).toBeNull();
    expect(commentToSend(` ${"a".repeat(COMMENT_MAX)} `)).toHaveLength(COMMENT_MAX);
  });
});

describe("commentActions", () => {
  it("gives my own comment Delete only", () => {
    expect(commentActions({ mine: true, can_delete: true })).toEqual(["delete"]);
  });
  it("gives someone else's Report and Block, and Delete on my workout", () => {
    expect(commentActions({ mine: false, can_delete: false })).toEqual(["report", "block"]);
    expect(commentActions({ mine: false, can_delete: true })).toEqual(["report", "block", "delete"]);
  });
});

describe("counts and labels", () => {
  it("reads the server's count, 0 when missing", () => {
    expect(readCommentCount({ comment_count: 3 })).toBe(3);
    expect(readCommentCount({ comment_count: "2" })).toBe(2);
    expect(readCommentCount({})).toBe(0);
    expect(readCommentCount({ comment_count: null })).toBe(0);
    expect(readCommentCount({ comment_count: -1 })).toBe(0);
  });
  it("labels", () => {
    expect(commentCountLabel(1)).toBe("1 comment");
    expect(commentCountLabel(4)).toBe("4 comments");
    expect(commentsRowLabel(0)).toBe("Comments");
    expect(commentsRowLabel(2)).toBe("2 comments");
  });
});

describe("withoutAuthor", () => {
  it("drops a blocked person's comments", () => {
    const rows = [{ user_id: "a" }, { user_id: "b" }, { user_id: "a" }];
    expect(withoutAuthor(rows, "a")).toEqual([{ user_id: "b" }]);
  });
});

describe("commentSnippet", () => {
  it("keeps a short comment and flattens whitespace", () => {
    expect(commentSnippet("Nice\n\nPR")).toBe("Nice PR");
  });
  it("cuts on a word", () => {
    expect(commentSnippet("one two three four five", 12)).toBe("one two…");
  });
  it("cuts mid-word when there is no early space", () => {
    expect(commentSnippet("abcdefghijklmnop", 5)).toBe("abcde…");
  });
});
