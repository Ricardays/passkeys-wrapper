// mastercard-config.js

let _checkoutSdk = null;

/**
 * Initializes the Mastercard SDK.
 * @param {Object} config - Configuration object
 * @param {string} config.environment - 'sandbox' or 'production'
 * @param {string} config.locale - e.g., 'en_US', 'es_CL'
 * @returns {Promise<Object>} - A promise that resolves to the configured Mastercard SDK instance
 */
export async function initMastercardSdk(config) {
    // Check if already initialized
    if (_checkoutSdk) {
        return _checkoutSdk;
    }

    // 1. Load the Mastercard SDK script dynamically if it's not already loaded
    if (!window.AUTHSDK_MASTERCARD) {
        await _loadSdkScript(config.environment || 'sandbox');
    }

    // 2. THE FIX: The SDK is already a ready-to-use object.
    // We don't need to call "new" or "configure", we just assign it.
    _checkoutSdk = window.AUTHSDK_MASTERCARD;

    console.log("Mastercard SDK initialized. Available methods:", Object.keys(_checkoutSdk));

    return _checkoutSdk;
}

/**
 * Private helper to load the correct SDK script based on the environment.
 * @param {string} environment
 */
async function _loadSdkScript(environment) {
    return new Promise((resolve, reject) => {
        const scriptUrl = environment === 'production'
            ? 'https://src.mastercard.com/auth/js/sdk.js' // Production URL
            : 'https://sandbox.src.mastercard.com/auth/js/sdk.js'; // Sandbox URL

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
 * Throws an error if called before initMastercardSdk().
 * @returns {Object} The Mastercard SDK instance
 */
export function getMastercardSdk() {
    if (!_checkoutSdk) {
        throw new Error('Mastercard SDK not initialized. Call initMastercardSdk() first.');
    }
    return _checkoutSdk;
}

// --- Translation Functions ---
/**
 * Maps authentication reason to Mastercard's expected value.
 * @param {string} reason - e.g., 'login', 'payment', 'enroll'
 * @returns {string} - e.g., 'TRANSACTION_AUTHENTICATION'
 */
export function mapAuthReason(reason) {
    const reasonMap = {
        'login': 'TRANSACTION_AUTHENTICATION',
        'payment': 'TRANSACTION_AUTHENTICATION',
        'enroll': 'ENROL_FINANCIAL_INSTRUMENT',
        // Add other mappings as needed
    };
    return reasonMap[reason] || 'TRANSACTION_AUTHENTICATION'; // Default
}

/**
 * Maps authentication type to Mastercard's method type.
 * @param {string} type - e.g., '3ds', 'passkey'
 * @returns {string} - e.g., '3DS'
 */
export function mapAuthMethodType(type) {
    const typeMap = {
        '3ds': '3DS',
        'passkey': 'MANAGED_AUTHENTICATION', // Assuming passkeys use managed auth
    };
    return typeMap[type] || '3DS'; // Default
}