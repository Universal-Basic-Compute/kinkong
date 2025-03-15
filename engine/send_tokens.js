"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTokens = sendTokens;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var dotenv = require("dotenv");
dotenv.config();
// Setup logging
function setupLogging() {
    var logger = {
        info: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return console.log.apply(console, __spreadArray(["[INFO] ".concat(message)], args, false));
        },
        error: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return console.error.apply(console, __spreadArray(["[ERROR] ".concat(message)], args, false));
        },
        warn: function (message) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return console.warn.apply(console, __spreadArray(["[WARN] ".concat(message)], args, false));
        },
    };
    return logger;
}
var logger = setupLogging();
// Function to send tokens
function sendTokens(destinationWallet_1, tokenMint_1, amount_1) {
    return __awaiter(this, arguments, void 0, function (destinationWallet, tokenMint, amount, decimals) {
        var privateKeyString, privateKey, sourceWalletKeypair, sourceWalletAddress, rpcUrl, connection, tokenMintPublicKey, token, sourceTokenAccount, destinationWalletPublicKey, destinationTokenAccount, amountWithDecimals, transaction, signature, error_1;
        if (decimals === void 0) { decimals = 9; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    logger.info("Starting token transfer to ".concat(destinationWallet));
                    privateKeyString = process.env.STRATEGY_WALLET_PRIVATE_KEY;
                    if (!privateKeyString) {
                        throw new Error('STRATEGY_WALLET_PRIVATE_KEY not found in environment variables');
                    }
                    privateKey = Uint8Array.from(Buffer.from(privateKeyString, 'base64'));
                    sourceWalletKeypair = web3_js_1.Keypair.fromSecretKey(privateKey);
                    sourceWalletAddress = sourceWalletKeypair.publicKey.toString();
                    if (sourceWalletAddress !== 'FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY') {
                        throw new Error("Source wallet address mismatch. Expected: FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY, Got: ".concat(sourceWalletAddress));
                    }
                    rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
                    connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
                    tokenMintPublicKey = new web3_js_1.PublicKey(tokenMint);
                    token = new spl_token_1.Token(connection, tokenMintPublicKey, spl_token_1.TOKEN_PROGRAM_ID, sourceWalletKeypair);
                    return [4 /*yield*/, token.getOrCreateAssociatedAccountInfo(sourceWalletKeypair.publicKey)];
                case 1:
                    sourceTokenAccount = _a.sent();
                    destinationWalletPublicKey = new web3_js_1.PublicKey(destinationWallet);
                    return [4 /*yield*/, token.getOrCreateAssociatedAccountInfo(destinationWalletPublicKey)];
                case 2:
                    destinationTokenAccount = _a.sent();
                    amountWithDecimals = new spl_token_1.u64(amount * Math.pow(10, decimals));
                    transaction = new web3_js_1.Transaction().add(spl_token_1.Token.createTransferInstruction(spl_token_1.TOKEN_PROGRAM_ID, sourceTokenAccount.address, destinationTokenAccount.address, sourceWalletKeypair.publicKey, [], amountWithDecimals));
                    logger.info("Sending ".concat(amount, " tokens to ").concat(destinationWallet));
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [sourceWalletKeypair])];
                case 3:
                    signature = _a.sent();
                    logger.info("Transfer successful! Transaction signature: ".concat(signature));
                    // Send notification if configured
                    return [4 /*yield*/, sendTelegramNotification({
                            token: tokenMint,
                            amount: amount,
                            destination: destinationWallet,
                            txSignature: signature
                        })];
                case 4:
                    // Send notification if configured
                    _a.sent();
                    return [2 /*return*/, signature];
                case 5:
                    error_1 = _a.sent();
                    logger.error('Error sending tokens:', error_1);
                    throw error_1;
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Function to send Telegram notification
function sendTelegramNotification(transferData) {
    return __awaiter(this, void 0, void 0, function () {
        var telegramBotToken, telegramChatId, message, url, response, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
                    telegramChatId = process.env.TELEGRAM_CHAT_ID;
                    if (!telegramBotToken || !telegramChatId) {
                        logger.warn('Telegram notification skipped: missing configuration');
                        return [2 /*return*/];
                    }
                    message = "\n\uD83D\uDD04 *Token Transfer Executed*\n\n*Token:* `".concat(transferData.token, "`\n*Amount:* ").concat(transferData.amount, "\n*Destination:* `").concat(transferData.destination, "`\n*Transaction:* [View on Explorer](https://solscan.io/tx/").concat(transferData.txSignature, ")\n    ");
                    url = "https://api.telegram.org/bot".concat(telegramBotToken, "/sendMessage");
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                chat_id: telegramChatId,
                                text: message,
                                parse_mode: 'Markdown',
                                disable_web_page_preview: true,
                            }),
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Telegram API error: ".concat(response.statusText));
                    }
                    logger.info('Telegram notification sent successfully');
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    logger.error('Failed to send Telegram notification:', error_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Command line interface
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, destinationWallet, tokenMint, amount, decimals, signature, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    args = process.argv.slice(2);
                    if (args.length < 3) {
                        console.log('Usage: ts-node send_tokens.ts <destination_wallet> <token_mint> <amount> [decimals=9]');
                        process.exit(1);
                    }
                    destinationWallet = args[0];
                    tokenMint = args[1];
                    amount = parseFloat(args[2]);
                    decimals = args.length > 3 ? parseInt(args[3]) : 9;
                    if (isNaN(amount) || amount <= 0) {
                        throw new Error('Amount must be a positive number');
                    }
                    return [4 /*yield*/, sendTokens(destinationWallet, tokenMint, amount, decimals)];
                case 1:
                    signature = _a.sent();
                    console.log("\u2705 Transfer completed successfully. Signature: ".concat(signature));
                    process.exit(0);
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('❌ Transfer failed:', error_3);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Run the script if executed directly
if (require.main === module) {
    main();
}
