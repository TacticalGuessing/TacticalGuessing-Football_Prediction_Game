// backend/src/utils/__tests__/scoringUtils.test.js

const { calculatePoints } = require('../scoringUtils'); // Require the extracted function

describe('Scoring Utility - calculatePoints', () => {

  // Helper function to create mock prediction/result objects
  const mockData = (predH, predA, actualH, actualA, isJoker = false) => ({
      prediction: { predicted_home_goals: predH, predicted_away_goals: predA, is_joker: isJoker },
      actualResult: { home_score: actualH, away_score: actualA }
  });

  // Test Exact Scores (3 points)
  test('should return 3 points for exact score (home win)', () => {
    const { prediction, actualResult } = mockData(2, 1, 2, 1);
    expect(calculatePoints(prediction, actualResult)).toBe(3);
  });
  test('should return 3 points for exact score (away win)', () => {
    const { prediction, actualResult } = mockData(0, 1, 0, 1);
    expect(calculatePoints(prediction, actualResult)).toBe(3);
  });
  test('should return 3 points for exact score (draw)', () => {
    const { prediction, actualResult } = mockData(1, 1, 1, 1);
    expect(calculatePoints(prediction, actualResult)).toBe(3);
  });
   test('should return 3 points for exact score (0-0 draw)', () => {
    const { prediction, actualResult } = mockData(0, 0, 0, 0);
    expect(calculatePoints(prediction, actualResult)).toBe(3);
  });

  // Test Correct Outcome (1 point)
  test('should return 1 point for correct outcome (home win, wrong score)', () => {
    const { prediction, actualResult } = mockData(1, 0, 2, 0);
    expect(calculatePoints(prediction, actualResult)).toBe(1);
    const { prediction: p2, actualResult: r2 } = mockData(3, 1, 2, 1);
    expect(calculatePoints(p2, r2)).toBe(1);
  });
  test('should return 1 point for correct outcome (away win, wrong score)', () => {
    const { prediction, actualResult } = mockData(0, 1, 0, 2);
    expect(calculatePoints(prediction, actualResult)).toBe(1);
    const { prediction: p2, actualResult: r2 } = mockData(1, 3, 1, 2);
    expect(calculatePoints(p2, r2)).toBe(1);
  });
  test('should return 1 point for correct outcome (draw, wrong score)', () => {
    const { prediction, actualResult } = mockData(1, 1, 2, 2);
    expect(calculatePoints(prediction, actualResult)).toBe(1);
    const { prediction: p2, actualResult: r2 } = mockData(0, 0, 3, 3);
    expect(calculatePoints(p2, r2)).toBe(1);
  });

  // Test Incorrect Outcome (0 points)
  test('should return 0 points for incorrect outcome (predicted home win, actual away win)', () => {
    const { prediction, actualResult } = mockData(2, 1, 0, 1);
    expect(calculatePoints(prediction, actualResult)).toBe(0);
  });
  test('should return 0 points for incorrect outcome (predicted away win, actual home win)', () => {
    const { prediction, actualResult } = mockData(0, 1, 1, 0);
    expect(calculatePoints(prediction, actualResult)).toBe(0);
  });
  test('should return 0 points for incorrect outcome (predicted home win, actual draw)', () => {
    const { prediction, actualResult } = mockData(1, 0, 1, 1);
    expect(calculatePoints(prediction, actualResult)).toBe(0);
  });
  test('should return 0 points for incorrect outcome (predicted draw, actual away win)', () => {
    const { prediction, actualResult } = mockData(1, 1, 0, 1);
    expect(calculatePoints(prediction, actualResult)).toBe(0);
  });

  // Test Invalid/Null Inputs (0 points)
  test('should return 0 points if predicted score is null', () => {
     const { prediction: p1, actualResult: r1 } = mockData(null, 1, 2, 1);
     expect(calculatePoints(p1, r1)).toBe(0);
     const { prediction: p2, actualResult: r2 } = mockData(1, null, 2, 1);
     expect(calculatePoints(p2, r2)).toBe(0);
  });
  test('should return 0 points if actual score is null', () => {
    const { prediction: p1, actualResult: r1 } = mockData(1, 1, null, 1);
    expect(calculatePoints(p1, r1)).toBe(0);
    const { prediction: p2, actualResult: r2 } = mockData(1, 1, 1, null);
    expect(calculatePoints(p2, r2)).toBe(0);
  });
   test('should return 0 points if score is negative', () => {
     const { prediction: p1, actualResult: r1 } = mockData(-1, 1, 2, 1);
     expect(calculatePoints(p1, r1)).toBe(0);
     const { prediction: p2, actualResult: r2 } = mockData(1, 1, 2, -1);
     expect(calculatePoints(p2, r2)).toBe(0);
   });
   test('should return 0 points if score is not a number', () => {
     const { prediction: p1, actualResult: r1 } = mockData('a', 1, 2, 1);
     expect(calculatePoints(p1, r1)).toBe(0);
      const { prediction: p2, actualResult: r2 } = mockData(1, NaN, 2, 1);
     expect(calculatePoints(p2, r2)).toBe(0);
   });

   // Test Joker functionality
   test('should return 6 points for exact score with joker active', () => {
      const { prediction, actualResult } = mockData(2, 0, 2, 0, true); // is_joker = true
      expect(calculatePoints(prediction, actualResult)).toBe(6);
   });
    test('should return 2 points for correct outcome with joker active', () => {
      const { prediction, actualResult } = mockData(1, 0, 3, 0, true); // is_joker = true
      expect(calculatePoints(prediction, actualResult)).toBe(2);
   });
   test('should return 0 points for incorrect outcome even with joker active', () => {
      const { prediction, actualResult } = mockData(1, 0, 0, 1, true); // is_joker = true
      expect(calculatePoints(prediction, actualResult)).toBe(0);
   });
    test('should not double points if joker is false or missing', () => {
      const { prediction: p1, actualResult: r1 } = mockData(1, 1, 1, 1, false); // is_joker = false
      expect(calculatePoints(p1, r1)).toBe(3);
      const { prediction: p2, actualResult: r2 } = mockData(1, 1, 1, 1); // is_joker missing (defaults to falsey)
      expect(calculatePoints(p2, r2)).toBe(3);
   });

});