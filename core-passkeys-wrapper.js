// core-passkeys-wrapper.js

/**
 * Core Passkeys Wrapper Library
 * 
 * A JavaScript wrapper library that abstracts the Mastercard Passkeys SDK integration
 * for seamless authentication flows within the Core system ecosystem.
 * 
 * This library provides:
 * - Simplified initialization and configuration
 * - Automatic token information retrieval from Core API
 * - Translation between Core data formats and Mastercard SDK requirements
 * - Complete authentication flow management
 * - Consistent error handling and response formatting
 * 
 * Key Features:
 * - Environment-aware configuration (local, sandbox, production)
 * - Automatic SDK script loading and initialization
 * - Core API integration for token data retrieval
 * - Data mapping and transformation
 * - Unified error handling with custom error types
 * 
 * @module CorePasskeysWrapper
 * @version 1.0.0
 */

let isInitialized = false;
let _checkoutSdk = null;
let _environment = 'sandbox'; // Default environment

// ============================================================================
// Public API Methods
// ============================================================================

/**
 * Initializes the wrapper library. Must be called once before any other function.
 * @param {Object} config - Configuration object for the wrapper
 * @param {string} config.environment - 'sandbox', 'production', or 'local'
 * @param {string} config.locale - e.g., 'en_US', 'es_CL'
 */
export async function init(config) {
    if (isInitialized) {
        console.warn('CorePasskeysWrapper is already initialized.');
        return;
    }
    // Store the environment for later use
    _environment = config.environment || 'sandbox';
    
    // Initialize the Mastercard SDK under the hood
    await initMastercardSdk(config);
    isInitialized = true;
}

/**
 * Returns the initialization status of the wrapper.
 * @returns {boolean} True if the wrapper has been initialized.
 */
export function isReady() {
    return isInitialized;
}

/**
 * Executes the complete authentication flow: initialization, fetching coreData, and authentication.
 * @param {Object} params - Parameters for the authentication flow.
 * @param {string} params.managerCode - The manager code (e.g., 'azul').
 * @param {string} params.merchantCode - The merchant UUID.
 * @param {string} params.tokenCode - The token UUID.
 * @param {string} params.authMethod - Authentication method type ('3ds' or 'passkey').
 * @param {string} params.authReason - Authentication reason ('login', 'payment', 'enroll').
 * @param {Object} params.amount - Transaction amount details.
 * @param {string} params.amount.value - The transaction amount.
 * @param {string} params.amount.currency - The transaction currency code.
 * @param {string} params.acquirerMerchantId - The acquirer merchant ID.
 * @param {string} params.acquirerBIN - The acquirer BIN.
 * @param {string} params.merchantCategoryCode - The merchant category code.
 * @param {string} params.merchantCountryCode - The merchant country code.
 * @param {Object} config - Configuration for initialization.
 * @param {string} config.environment - 'sandbox', 'production', or 'local'
 * @param {string} config.locale - e.g., 'en_US', 'es_CL'
 * @returns {Promise<Object>} - The authentication result.
 */
export async function executeAuthenticate(params, config = {}) {
    try {
        console.log("Starting complete authentication flow...");
        
        // 1. Initialize the SDK if not already initialized
        if (!isInitialized) {
            console.log("Initializing wrapper...");
            await init(config);
        }

        // 2. Fetch coreData from the Core API
        console.log("Fetching coreData from Core API...");
        const coreData = await getTokenBrandInfo({
            managerCode: params.managerCode,
            merchantCode: params.merchantCode,
            tokenCode: params.tokenCode
        });
        
        // 3. Execute authentication with the fetched coreData and additional params
        console.log("Starting authentication with coreData and additional parameters...");
        const authResult = await authenticate({
            ...coreData, 
            authMethod: params.authMethod,
            authReason: params.authReason,
            amount: params.amount,
            acquirerMerchantId: params.acquirerMerchantId,
            acquirerBIN: params.acquirerBIN,
            merchantCategoryCode: params.merchantCategoryCode,
            merchantCountryCode: params.merchantCountryCode
        });
        
        console.log("✅ Authentication flow completed successfully!");
        return authResult;
        
    } catch (error) {
        console.error("❌ Authentication flow failed:", error);
        throw error;
    }
}

/**
 * Main function to initiate a passkey authentication flow.
 * @param {Object} coreData - The data object provided by the Core API.
 * @returns {Promise<Object>} - A promise resolving to a simplified, Core-friendly response.
 */
export async function authenticate(coreData) {
    if (!isInitialized) {
        throw new CorePasskeysError('CorePasskeysWrapper not initialized. Please call init() first.');
    }
    const sdk = getMastercardSdk();

    // Extract values from coreData structure (both from API and passed params)
    const {
        unifiedServiceId,
        unifiedClientId,
        unifiedTokenId,
        merchantInfo,
        billingAddress,
        authMethod,
        authReason,
        amount,
        acquirerMerchantId,
        acquirerBIN, 
        merchantCategoryCode,
        merchantCountryCode
    } = coreData;

    // Map Core Data -> Mastercard Payload
    const mastercardPayload = {
        srcCorrelationId: generateUUID(),
        serviceId: unifiedServiceId,
        srcClientId: unifiedClientId,
        traceId: generateUUID(),
        accountReference: {
            srcDigitalCardId: unifiedTokenId
        },
        authenticationMethod: {
            authenticationMethodType: mapAuthMethodType(authMethod),
            authenticationSubject: "CARDHOLDER",
        },
        authenticationContext: {
            authenticationReasons: [mapAuthReason(authReason)],
            acquirerMerchantId: acquirerMerchantId,
            acquirerBIN: acquirerBIN,
            dpaData: {
                dpaName: merchantInfo?.name,
                dpaUri: merchantInfo?.web,
            },
            dpaTransactionOptions: {
                transactionAmount: {
                    transactionAmount: amount.value.toString(),
                    transactionCurrencyCode: amount.currency,
                },
                dpaLocale: merchantInfo?.locale,
                threeDsInputData: {
                    billingAddress: mapBillingAddress(billingAddress)
                },
                merchantCategoryCode: merchantCategoryCode,
                merchantCountryCode: merchantCountryCode,
            }
        }
    };

    try {
        console.log("Calling Mastercard SDK with payload:", mastercardPayload);
        const sdkResponse = await sdk.authenticate(mastercardPayload);
        return translateSdkResponse(sdkResponse);
    } catch (error) {
        console.error("Mastercard SDK authentication error:", error);
        throw translateSdkError(error);
    }
}

// ============================================================================
// Core API Client Methods
// ============================================================================

/**
 * Fetches token brand information from the Core API.
 * This is where the coreData for authentication will come from.
 * @param {Object} params - Parameters for the API call.
 * @param {string} params.managerCode - The manager code (e.g., 'azul').
 * @param {string} params.merchantCode - The merchant UUID.
 * @param {string} params.tokenCode - The token UUID.
 * @returns {Promise<Object>} - The coreData object from the Core API response.
 */
export async function getTokenBrandInfo(params) {
    const { managerCode, merchantCode, tokenCode } = params;

    // Validate required parameters
    if (!managerCode || !merchantCode || !tokenCode) {
        throw new CorePasskeysError('Missing required parameters: managerCode, merchantCode, and tokenCode are all required.', 'INVALID_INPUT');
    }

    // Determine the base URL based on environment
    let baseUrl;
    switch (_environment) {
        case 'local':
        case 'development':
            baseUrl = 'http://localhost:18080';
            break;
        case 'production':
            baseUrl = 'REDACTED';
            break;
        case 'sandbox':
        default:
            baseUrl = 'REDACTED';
            break;
    }

    // Construct the full API URL
    const apiUrl = `${baseUrl}/tr-tsp-api-core/v1/private/manager/${managerCode}/merchant/${merchantCode}/token/${tokenCode}/brand-info`;

    console.log(`Fetching coreData from: ${apiUrl} (environment: ${_environment})`);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Core API request failed with status ${response.status}: ${response.statusText}`);
        }

        const coreData = await response.json();
        console.log("Received coreData from Core API:", coreData);
        return coreData;
    } catch (error) {
        console.error("Error fetching token brand info from Core API:", error);
        throw new CorePasskeysError(`Failed to fetch token information: ${error.message}`, 'CORE_API_ERROR');
    }
}

// ============================================================================
// Mastercard SDK Initialization
// ============================================================================

/**
 * Initializes the Mastercard SDK.
 * @param {Object} config - Configuration object
 * @param {string} config.environment - 'sandbox' or 'production'
 * @param {string} config.locale - e.g., 'en_US', 'es_CL'
 * @returns {Promise<Object>} - A promise that resolves to the configured Mastercard SDK instance
 */
async function initMastercardSdk(config) {
    if (_checkoutSdk) {
        return _checkoutSdk;
    }

    // Load the Mastercard SDK script dynamically if it's not already loaded
    if (!window.AUTHSDK_MASTERCARD) {
        await _loadSdkScript(config.environment || 'sandbox');
    }

    // The SDK is already a ready-to-use object.
    _checkoutSdk = window.AUTHSDK_MASTERCARD;
    console.log("Mastercard SDK initialized. Available methods:", Object.keys(_checkoutSdk));
    return _checkoutSdk;
}

/**
 * Private helper to load the correct SDK script based on the environment.
 * @param {string} environment - The environment ('sandbox' or 'production')
 * @returns {Promise<void>} - A promise that resolves when the script is loaded
 */
async function _loadSdkScript(environment) {
    return new Promise((resolve, reject) => {
        const scriptUrl = environment === 'production'
            ? 'https://src.mastercard.com/auth/js/sdk.js'
            : 'https://sandbox.src.mastercard.com/auth/js/sdk.js';

        const script = document.createElement('script');
        script.src = scriptUrl;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load Mastercard SDK from ${scriptUrl}`));
        document.head.appendChild(script);
    });
}

/**
 * Public getter to access the pre-initialized SDK.
 * @returns {Object} The Mastercard SDK instance
 * @throws {Error} If the SDK is not initialized
 */
function getMastercardSdk() {
    if (!_checkoutSdk) {
        throw new Error('Mastercard SDK not initialized. Call init() first.');
    }
    return _checkoutSdk;
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Generates a UUID v4. Uses crypto.randomUUID() if available, otherwise a fallback.
 * @returns {string} A UUID v4 string.
 */
function generateUUID() {
    try {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    } catch (e) {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

/**
 * Maps a billing address object to the Mastercard billingAddress structure.
 * @param {Object} billingAddress - The billing address object from coreData.
 * @returns {Object} The Mastercard billingAddress object.
 */
function mapBillingAddress(billingAddress) {
    return {
        line1: billingAddress?.line1 || '',
        line2: billingAddress?.line2 || '',
        city: billingAddress?.city || '',
        state: billingAddress?.state || '',
        zip: billingAddress?.zip || '',
        countryCode: billingAddress?.country || ''
    };
}

/**
 * Translates the Mastercard SDK response into a simpler, Core-friendly format.
 * @param {Object} sdkResponse - The raw response from the Mastercard SDK.
 * @returns {Object} A simplified response for the Core API.
 */
function translateSdkResponse(sdkResponse) {
    console.log("SDK Response Received: ", sdkResponse);
    const coreResponse = {
        assuranceData: sdkResponse.assuranceData,
        authenticationStatus: sdkResponse.authenticationStatus,
        authenticationResult: sdkResponse.authenticationResult,
        srcCorrelationId: sdkResponse.srcCorrelationId
    };
    return coreResponse;
}

/**
 * Translates Mastercard SDK errors into standardized Core errors.
 * @param {Error} sdkError - The error thrown by the Mastercard SDK.
 * @returns {CorePasskeysError} A custom error for the Core API.
 */
function translateSdkError(sdkError) {
    let message = 'Authentication failed';
    let code = 'AUTH_FAILED';

    if (sdkError.message?.includes('network') || sdkError.message?.includes('fetch')) {
        message = 'Network error occurred during authentication.';
        code = 'NETWORK_ERROR';
    } else if (sdkError.message?.includes('timeout')) {
        message = 'Authentication request timed out.';
        code = 'TIMEOUT';
    } else if (sdkError.message?.includes('invalid') || sdkError.message?.includes('validation')) {
        message = 'Invalid request data provided.';
        code = 'INVALID_INPUT';
    }

    return new CorePasskeysError(`${message} (Original: ${sdkError.message})`, code);
}

/**
 * Maps authentication reason to Mastercard's expected value.
 * @param {string} reason - The reason code ('login', 'payment', 'enroll').
 * @returns {string} The Mastercard authentication reason value.
 */
function mapAuthReason(reason) {
    const reasonMap = {
        'login': 'TRANSACTION_AUTHENTICATION',
        'payment': 'TRANSACTION_AUTHENTICATION',
        'enroll': 'ENROL_FINANCIAL_INSTRUMENT',
    };
    return reasonMap[reason] || 'TRANSACTION_AUTHENTICATION';
}

/**
 * Maps authentication type to Mastercard's method type.
 * @param {string} type - The type code ('3ds', 'passkey').
 * @returns {string} The Mastercard authentication method type value.
 */
function mapAuthMethodType(type) {
    const typeMap = {
        '3ds': '3DS',
        'passkey': 'MANAGED_AUTHENTICATION',
    };
    return typeMap[type] || '3DS';
}

// ============================================================================
// Custom Error Class
// ============================================================================

/**
 * Custom error class for Core Passkeys wrapper errors.
 */
export class CorePasskeysError extends Error {
    /**
     * Creates a new CorePasskeysError.
     * @param {string} message - The error message.
     * @param {string} code - A short error code for programmatic handling.
     */
    constructor(message, code = 'UNKNOWN_ERROR') {
        super(message);
        this.name = 'CorePasskeysError';
        this.code = code;
    }
}