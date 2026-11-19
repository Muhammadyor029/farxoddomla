import { describe, expect, it } from "vitest";
import { wrapWordsToWidth } from "../src/lib/pdfExport";
import { isOwnerAccount, type UserAccount } from "../shared/types";
import { getGradeGamesBank, shuffleChoiceRound } from "../src/data/gamesBank";

describe("Security role checks, PDF word wrapping & 40 grade-by-game pools", () => {
  it("evaluates owner privileges strictly by server-verified role/permission rather than username", () => {
    const adminUser = {
      id: 1,
      email: "platform_admin@huquqolami.uz",
      fullName: "Admin",
      role: "admin",
      gradeNumber: 11,
      className: "11-A",
      schoolName: "Maktab",
      xp: 0,
      level: 1,
      streakDays: 0,
      createdAt: "2026-01-01T00:00:00Z",
      canUnlockTopics: true,
    } as UserAccount;
    const impersonatorStudent: UserAccount = {
      ...adminUser,
      id: 2,
      email: "fahodjon123",
      role: "student",
      canUnlockTopics: false,
    };

    expect(isOwnerAccount(adminUser)).toBe(true);
    expect(isOwnerAccount(impersonatorStudent)).toBe(false);
    expect(isOwnerAccount(null)).toBe(false);
  });

  it("wraps long Uzbek sentences and unspaced long tokens without overflowing PDF width", () => {
    const fakeMeasure = (text: string) => text.length * 6;
    const maxWidth = 120; // 20 characters max per line

    const longUrl = "https://lex.uz/uz/docs/6445145/konstitutsiya-modda-15-batafsil";
    const lines = wrapWordsToWidth(longUrl, fakeMeasure, maxWidth);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) {
      expect(fakeMeasure(line)).toBeLessThanOrEqual(maxWidth);
    }

    const uzbekText = "O‘zbekiston Respublikasining Konstitutsiyasi — oliy yuridik kuchga ega asosiy qonun.";
    const wrappedUz = wrapWordsToWidth(uzbekText, fakeMeasure, maxWidth);
    expect(wrappedUz.length).toBeGreaterThanOrEqual(4);
    for (const line of wrappedUz) {
      expect(fakeMeasure(line)).toBeLessThanOrEqual(maxWidth);
    }

    expect(wrapWordsToWidth("   ", fakeMeasure, maxWidth)).toEqual([]);
  });

  it("populates all 40 grade-by-game pools across Grades 8–11 and preserves correct answers on shuffle", () => {
    let totalGameItems = 0;
    for (const grade of [8, 9, 10, 11]) {
      const bank = getGradeGamesBank(grade);
      expect(bank.huquqiy_detektiv.length).toBeGreaterThanOrEqual(6);
      expect(bank.sud_zali.length).toBeGreaterThanOrEqual(6);
      expect(bank.huquqiy_domino.length).toBeGreaterThanOrEqual(6);
      expect(bank.mosini_top.length).toBeGreaterThanOrEqual(6);
      expect(bank.qonuniy_yoki_noqonuniy.length).toBeGreaterThanOrEqual(8);
      expect(bank.huquqiy_krossvord.length).toBeGreaterThanOrEqual(7);
      expect(bank.tezkor_qaror.length).toBeGreaterThanOrEqual(6);
      expect(bank.huquqiy_labirint.length).toBeGreaterThanOrEqual(2);
      expect(bank.xatoni_top.length).toBeGreaterThanOrEqual(6);
      expect(bank.voqeani_tahlil_qil.length).toBeGreaterThanOrEqual(2);

      totalGameItems +=
        bank.huquqiy_detektiv.length +
        bank.sud_zali.length +
        bank.huquqiy_domino.length +
        bank.mosini_top.length +
        bank.qonuniy_yoki_noqonuniy.length +
        bank.huquqiy_krossvord.length +
        bank.tezkor_qaror.length +
        bank.huquqiy_labirint.length +
        bank.xatoni_top.length +
        bank.voqeani_tahlil_qil.length;

      for (const round of bank.huquqiy_detektiv) {
        const expectedCorrect = round.options[round.correctIndex];
        const shuffled = shuffleChoiceRound(round);
        expect(shuffled.options[shuffled.correctIndex]).toBe(expectedCorrect);
      }
    }
    expect(totalGameItems).toBeGreaterThanOrEqual(220);
  });
});
