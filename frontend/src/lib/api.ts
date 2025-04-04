// frontend/src/lib/api.ts

// Define the base URL for the API
// Ensure NEXT_PUBLIC_API_URL is set in your .env.local file
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'; // Adjusted default

// --- Interfaces for API Data Structures ---

// User Authentication
export interface RegisterUserData {
    name: string;
    email: string;
    password?: string;
}

export interface LoginCredentials {
    email: string;
    password?: string;
}

export interface User {
    userId: number;
    name: string;
    email: string;
    role: 'PLAYER' | 'ADMIN';
}

export interface AuthResponse {
    token: string;
    user: User;
}

// Rounds and Fixtures
export interface Round {
    roundId: number;
    name: string;
    deadline: string; // ISO date string
    status: 'SETUP' | 'OPEN' | 'CLOSED' | 'COMPLETED';
}

export interface Fixture {
    fixtureId: number;
    roundId: number;
    homeTeam: string;
    awayTeam: string;
    matchTime: string; // ISO date string
    homeScore?: number | null; // Optional or null
    awayScore?: number | null; // Optional or null
}

// Predictions
export interface Prediction {
    predictionId?: number;
    userId?: number;
    fixtureId: number;
    roundId?: number;
    predictedHomeGoals: number | null;
    predictedAwayGoals: number | null;
    pointsAwarded?: number | null;
    isJoker?: boolean;
    submittedAt?: string; // ISO date string
}

export interface PredictionPayload {
    fixtureId: number;
    predictedHomeGoals: number | null; // Allow null initially
    predictedAwayGoals: number | null; // Allow null initially
    // isJoker?: boolean; // Add later if needed
}

export interface FixtureWithPrediction extends Fixture {
    predictedHomeGoals?: number | null;
    predictedAwayGoals?: number | null;
    // isJoker?: boolean; // Add later if needed
}

export interface ActiveRoundResponse extends Round {
    fixtures: FixtureWithPrediction[];
}

// Simple types for specific use cases
export interface SimpleRound {
    roundId: number;
    name: string;
}

export interface StandingEntry {
    userId: number;
    points: number;
    name: string;
    // rank?: number; // Frontend calculates rank
}

// --- Admin Specific Interfaces ---

// Payload for creating a round
export interface CreateRoundPayload {
    name: string;
    deadline: string; // Expecting ISO format string or similar
}

// Payload for updating round status
export interface UpdateRoundStatusPayload {
    status: 'SETUP' | 'OPEN' | 'CLOSED';
}

// Payload for adding a single fixture
export interface AddFixturePayload {
    homeTeam: string;
    awayTeam: string;
    matchTime: string; // Expecting ISO format string or similar
}

/**
 * Type definition for the payload when submitting fixture results.
 */
export interface ResultPayload {
    homeScore: number;
    awayScore: number;
}


// --- Helper Function ---

/**
 * A wrapper around fetch that automatically adds the Authorization header
 * and handles common error scenarios.
 * NOTE: This helper *returns the Response object* on success, requires manual .json() parsing.
 * It throws an error on non-ok responses.
 */
const fetchWithAuth = async (url: string, options: RequestInit = {}, token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...Object.entries(options.headers || {}).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: headers,
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
          const errorData = await response.json();
          errorMessage = errorData?.message || errorMessage;
      } catch {
          // Ignore error if response body is not JSON or empty
      }
      console.error("API Fetch Error:", errorMessage, "URL:", url, "Options:", options);
      throw new Error(errorMessage); // Throws error here
    }

    return response; // Returns the raw Response object on success
};


// --- API Functions ---

// == User Facing Functions ==

/**
 * Registers a new user.
 */
export const registerUser = async (userData: RegisterUserData): Promise<void> => {
    await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    }, null);
    // No return value needed, fetchWithAuth throws on error
};

/**
 * Logs in a user.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }, null);
    // Parse JSON since fetchWithAuth succeeded
    return response.json() as Promise<AuthResponse>;
};

/**
 * Fetches the currently active round ('OPEN' status), its fixtures, and the logged-in user's predictions.
 */
export const getActiveRound = async (token: string): Promise<ActiveRoundResponse> => {
    const response = await fetchWithAuth('/rounds/active', { method: 'GET' }, token);
    // Parse JSON since fetchWithAuth succeeded
    return response.json() as Promise<ActiveRoundResponse>;
};

/**
 * Saves/updates user predictions for the active round.
 * Expects an array of prediction objects.
 */
export const savePredictions = async (predictions: PredictionPayload[], token: string): Promise<void> => {
    const payload = { predictions: predictions }; // Backend expects { predictions: [...] }
    await fetchWithAuth('/predictions', {
        method: 'POST',
        body: JSON.stringify(payload),
    }, token);
     // No return value needed, fetchWithAuth throws on error
};

/**
 * Fetches a list of completed rounds (for standings dropdown).
 */
export const getCompletedRounds = async (token: string): Promise<SimpleRound[]> => {
    const completedRounds: Round[] = await getRounds(token, 'COMPLETED');
    // Map full Round objects (already camelCased by getRounds) to SimpleRound objects
    return completedRounds.map(({ roundId, name }) => ({ roundId, name }));
};

/**
 * Fetches the standings for a specific completed round.
 */
export const getStandingsForRound = async (roundId: number, token: string): Promise<StandingEntry[]> => {
    const response = await fetchWithAuth(`/standings?roundId=${roundId}`, { method: 'GET' }, token);
    // Parse JSON since fetchWithAuth succeeded
    return response.json() as Promise<StandingEntry[]>;
};


// == Admin Functions ==

/**
 * Fetches a list of rounds (Admin). Can optionally filter by status.
 * Requires admin authentication. Returns rounds with camelCase properties.
 */
export const getRounds = async (token: string, status?: Round['status']): Promise<Round[]> => {
    const url = status ? `/rounds?status=${status}` : '/rounds';
    const response = await fetchWithAuth(url, { method: 'GET' }, token);
    const rawData = await response.json(); // Parse JSON since fetchWithAuth succeeded

    if (!Array.isArray(rawData)) {
        console.error("API Error: GET /rounds did not return an array. Response:", rawData);
        return [];
    }

    // Map snake_case (round_id) from backend to camelCase (roundId) for frontend
    const mappedData: Round[] = rawData.map(item => {
        const id = item.roundId ?? item.round_id;
        if (typeof id !== 'number' || typeof item.name !== 'string') {
            console.warn("API Warning: Received round item without valid numeric ID or name:", item);
            return null; // Mark item as invalid
        }
        return {
            roundId: id,
            name: item.name,
            deadline: item.deadline,
            status: item.status
        };
    }).filter((item): item is Round => item !== null); // Filter out any nulls (invalid items)

    console.log("api.ts: getRounds mapped data:", mappedData);
    return mappedData;
};


/**
 * Creates a new round (Admin).
 * Requires admin authentication.
 */
export const createRound = async (roundData: CreateRoundPayload, token: string): Promise<Round> => {
    const response = await fetchWithAuth('/rounds', {
        method: 'POST',
        body: JSON.stringify(roundData), // Send camelCase payload
    }, token);
    const createdRaw = await response.json(); // Parse JSON since fetchWithAuth succeeded

    // Map response to ensure frontend gets camelCase
    const id = createdRaw.roundId ?? createdRaw.round_id;
     if (typeof id !== 'number') throw new Error("Invalid roundId in createRound response");
     return {
        roundId: id,
        name: createdRaw.name,
        deadline: createdRaw.deadline,
        status: createdRaw.status
     };
};

/**
 * Updates the status of a specific round (Admin).
 * Requires admin authentication.
 */
export const updateRoundStatus = async (roundId: number, payload: UpdateRoundStatusPayload, token: string): Promise<void> => {
    await fetchWithAuth(`/rounds/${roundId}/status`, {
        method: 'PUT',
        body: JSON.stringify(payload), // Send { status: 'NEW_STATUS' }
    }, token);
    // No return value needed, fetchWithAuth throws on error
};

/**
 * Fetches all fixtures for a specific round (Admin).
 * Requires admin authentication. Returns fixtures with camelCase properties.
 */
export const getRoundFixtures = async (roundId: number, token: string): Promise<Fixture[]> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, { method: 'GET' }, token);
    const rawData = await response.json(); // Parse JSON since fetchWithAuth succeeded

    if (!Array.isArray(rawData)) {
        console.error(`API Error: GET /rounds/${roundId}/fixtures did not return an array. Response:`, rawData);
        return [];
    }

    const fixtures: Fixture[] = rawData.reduce((acc: Fixture[], item) => {
        const fixtureId = item.fixtureId ?? item.fixture_id;
        const roundIdFromItem = item.roundId ?? item.round_id;
        if (typeof fixtureId !== 'number' || typeof roundIdFromItem !== 'number' || typeof (item.homeTeam ?? item.home_team) !== 'string' || typeof (item.awayTeam ?? item.away_team) !== 'string' || typeof (item.matchTime ?? item.match_time) !== 'string') {
            console.warn("API Warning: Received fixture item without valid required fields (IDs, teams, time):", item);
            return acc;
        }
        const validFixture: Fixture = {
            fixtureId: fixtureId, roundId: roundIdFromItem, homeTeam: item.homeTeam ?? item.home_team, awayTeam: item.awayTeam ?? item.away_team, matchTime: item.matchTime ?? item.match_time,
            homeScore: (item.homeScore ?? item.home_score) === undefined ? null : (item.homeScore ?? item.home_score),
            awayScore: (item.awayScore ?? item.away_score) === undefined ? null : (item.awayScore ?? item.away_score),
        };
        acc.push(validFixture);
        return acc;
    }, []);

    console.log(`api.ts: getRoundFixtures(${roundId}) mapped data:`, fixtures);
    return fixtures;
};


/**
 * Adds a new fixture to a specific round (Admin).
 * Requires admin authentication.
 */
export const addFixture = async (roundId: number, fixtureData: AddFixturePayload, token: string): Promise<Fixture | void> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, {
        method: 'POST',
        body: JSON.stringify(fixtureData), // Send camelCase payload
    }, token);

    // Check if response is likely JSON before parsing
    if (response.status !== 204 && response.headers.get('content-type')?.includes('application/json')) {
        const createdRaw = await response.json();
        const fixtureId = createdRaw.fixtureId ?? createdRaw.fixture_id;
        const roundIdFromItem = createdRaw.roundId ?? createdRaw.round_id;
        if (typeof fixtureId !== 'number' || typeof roundIdFromItem !== 'number') {
            console.error("Invalid fixtureId or roundId in addFixture response:", createdRaw);
            throw new Error("Invalid data received after adding fixture.");
        }
        // Map response to camelCase Fixture
        return {
             fixtureId: fixtureId, roundId: roundIdFromItem, homeTeam: createdRaw.homeTeam ?? createdRaw.home_team, awayTeam: createdRaw.awayTeam ?? createdRaw.away_team, matchTime: createdRaw.matchTime ?? createdRaw.match_time,
             homeScore: (createdRaw.homeScore ?? createdRaw.home_score) === undefined ? null : (createdRaw.homeScore ?? createdRaw.home_score),
             awayScore: (createdRaw.awayScore ?? createdRaw.away_score) === undefined ? null : (createdRaw.awayScore ?? createdRaw.away_score),
        };
    }
    // Return void if no content or non-JSON response
};

/**
 * Submits the result for a specific fixture.
 * Requires admin authentication.
 * @param fixtureId - The ID of the fixture to update.
 * @param payload - The result data { homeScore, awayScore }.
 * @param token - The user's JWT authentication token.
 * @returns The updated fixture data or void if no content.
 * @throws Throws an error if the API call fails.
 */
export const enterFixtureResult = async (fixtureId: number, payload: ResultPayload, token: string): Promise<Fixture | void> => {
    const endpoint = `/fixtures/${fixtureId}/result`;

    try {
        const response = await fetchWithAuth(endpoint, {
            method: 'PUT',
            body: JSON.stringify(payload)
        }, token);

        if (response.status === 204) {
             return; // Return void for No Content
        }
        if (response.headers.get('content-type')?.includes('application/json')) {
             const updatedRaw = await response.json();
             // --- Add mapping logic similar to addFixture/getRoundFixtures if backend returns snake_case ---
             const updatedFixtureId = updatedRaw.fixtureId ?? updatedRaw.fixture_id;
             const updatedRoundId = updatedRaw.roundId ?? updatedRaw.round_id;

             if (typeof updatedFixtureId !== 'number' || typeof updatedRoundId !== 'number') {
                 console.error("Invalid fixtureId or roundId in enterFixtureResult response:", updatedRaw);
                 throw new Error("Invalid data received after updating fixture result.");
             }
             // Assuming backend returns the full updated fixture matching the Fixture interface (after potential mapping)
             return {
                fixtureId: updatedFixtureId,
                roundId: updatedRoundId,
                homeTeam: updatedRaw.homeTeam ?? updatedRaw.home_team,
                awayTeam: updatedRaw.awayTeam ?? updatedRaw.away_team,
                matchTime: updatedRaw.matchTime ?? updatedRaw.match_time,
                homeScore: updatedRaw.homeScore ?? updatedRaw.home_score ?? null, // Ensure null if undefined
                awayScore: updatedRaw.awayScore ?? updatedRaw.away_score ?? null, // Ensure null if undefined
             } as Fixture; // Assert or ensure mapping produces a valid Fixture
             // --- End mapping logic ---
        }
        // If response was OK, but not 204 and not JSON, return void
        return;

    } catch (error: unknown) { // Updated type from any to unknown
        console.error(`Error submitting result for fixture ${fixtureId}:`, error);
        // fetchWithAuth should throw an Error object, but we check just in case
        if (error instanceof Error) {
             throw error; // Re-throw the original formatted error
        } else {
             // Fallback if it's not an Error object for some reason
             throw new Error('An unknown error occurred while submitting the fixture result.');
        }
    }
};

// --- NEW FUNCTION ADDED HERE ---
/**
 * Triggers the scoring process for a specific CLOSED round.
 * Requires admin authentication. Backend handles score calculation and status update.
 * @param roundId - The ID of the round to score.
 * @param token - The user's JWT authentication token.
 * @returns Promise<void>
 * @throws Throws an error if the API call fails.
 */
export const triggerScoring = async (roundId: number, token: string): Promise<void> => {
    // *** IMPORTANT: Adjust the URL path if your backend endpoint is different ***
    const endpoint = `/rounds/${roundId}/score`;

    try {
        // Use POST as this is initiating an action/process
        await fetchWithAuth(endpoint, { method: 'POST' }, token);
        // Expecting 200 OK or 204 No Content on success, fetchWithAuth handles errors
        console.log(`Scoring triggered successfully for round ${roundId}`);
    } catch (error: unknown) {
        console.error(`Error triggering scoring for round ${roundId}:`, error);
        if (error instanceof Error) {
            throw error; // Re-throw the formatted error
        } else {
            throw new Error('An unknown error occurred while triggering scoring.');
        }
    }
};
// --- END OF NEW FUNCTION ---