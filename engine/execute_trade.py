import os
import json
import aiohttp
import traceback
import asyncio
import base58
import base64
import urllib.parse
from datetime import datetime
import logging
from typing import Dict, Optional
import urllib.parse
from dotenv import load_dotenv
import socket
from solders.keypair import Keypair
from solders.transaction import Transaction, VersionedTransaction
from solders.message import Message, MessageV0
from solders.instruction import AccountMeta, Instruction
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TxOpts
from solana.rpc.commitment import Commitment
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.signature import Signature
from spl.token.instructions import get_associated_token_address
from solana.rpc.commitment import Commitment

def setup_logging():
    """Configure logging"""
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger

# Configure Windows event loop policy
if os.name == 'nt':  # Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())






class JupiterTradeExecutor:
    def __init__(self):
        load_dotenv()
        self.logger = setup_logging()
        self._last_swap_result = None
        
        # Initialize wallet during class initialization
        try:
            private_key = os.getenv('STRATEGY_WALLET_PRIVATE_KEY')
            if not private_key:
                raise ValueError("STRATEGY_WALLET_PRIVATE_KEY not found")
            
            private_key_bytes = base58.b58decode(private_key)
            self.wallet_keypair = Keypair.from_bytes(private_key_bytes)
            self.wallet_address = str(self.wallet_keypair.pubkey())
            self.logger.info(f"Wallet initialized: {self.wallet_address[:8]}...")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize wallet: {e}")
            self.wallet_keypair = None
            self.wallet_address = None
            
    async def calculate_swap_losses(self, quote_data: dict, input_amount: float, output_amount: float) -> dict:
        """
        Calcule les pertes dues aux frais et au slippage
        
        Args:
            quote_data: Données du quote Jupiter
            input_amount: Montant d'entrée en unités normales (pas raw)
            output_amount: Montant de sortie réel reçu en unités normales
        
        Returns:
            dict: Détails des pertes (pourcentages et valeurs)
        """
        try:
            # Récupérer les informations du quote
            expected_output_raw = int(quote_data.get('outAmount', 0))
            input_mint = quote_data.get('inputMint')
            output_mint = quote_data.get('outputMint')
            
            # Obtenir les décimales pour les tokens
            input_decimals = self.get_token_decimals(input_mint)
            output_decimals = self.get_token_decimals(output_mint)
            
            # Convertir le montant de sortie attendu en unités normales
            expected_output = expected_output_raw / (10 ** output_decimals)
            
            # Obtenir les prix des tokens
            input_price = await self.get_token_price(input_mint)
            output_price = await self.get_token_price(output_mint)
            
            if not input_price or not output_price:
                self.logger.warning("Impossible d'obtenir les prix des tokens pour calculer les pertes")
                return {
                    "slippage_percent": 0,
                    "fees_percent": 0,
                    "total_loss_percent": 0,
                    "details": "Prix des tokens non disponibles"
                }
            
            # Valeur en USD
            input_value_usd = input_amount * input_price
            expected_output_value_usd = expected_output * output_price
            actual_output_value_usd = output_amount * output_price
            
            # Calcul des pertes
            total_loss_usd = input_value_usd - actual_output_value_usd
            total_loss_percent = (total_loss_usd / input_value_usd) * 100 if input_value_usd > 0 else 0
            
            # Estimation du slippage (différence entre le montant attendu et réel)
            slippage_usd = expected_output_value_usd - actual_output_value_usd
            slippage_percent = (slippage_usd / input_value_usd) * 100 if input_value_usd > 0 else 0
            
            # Les frais sont la différence entre la perte totale et le slippage
            # Note: C'est une approximation car il y a d'autres facteurs
            fees_usd = total_loss_usd - slippage_usd
            fees_percent = (fees_usd / input_value_usd) * 100 if input_value_usd > 0 else 0
            
            # Journaliser les résultats
            self.logger.info("\n📊 Analyse des pertes de swap:")
            self.logger.info(f"Montant d'entrée: {input_amount:.6f} (${input_value_usd:.2f})")
            self.logger.info(f"Sortie attendue: {expected_output:.6f} (${expected_output_value_usd:.2f})")
            self.logger.info(f"Sortie réelle: {output_amount:.6f} (${actual_output_value_usd:.2f})")
            self.logger.info(f"Perte totale: ${total_loss_usd:.2f} ({total_loss_percent:.2f}%)")
            self.logger.info(f"Slippage estimé: ${slippage_usd:.2f} ({slippage_percent:.2f}%)")
            self.logger.info(f"Frais estimés: ${fees_usd:.2f} ({fees_percent:.2f}%)")
            
            return {
                "input_amount": input_amount,
                "input_value_usd": input_value_usd,
                "expected_output": expected_output,
                "expected_output_value_usd": expected_output_value_usd,
                "actual_output": output_amount,
                "actual_output_value_usd": actual_output_value_usd,
                "total_loss_usd": total_loss_usd,
                "total_loss_percent": total_loss_percent,
                "slippage_usd": slippage_usd,
                "slippage_percent": slippage_percent,
                "fees_usd": fees_usd,
                "fees_percent": fees_percent
            }
            
        except Exception as e:
            self.logger.error(f"Erreur lors du calcul des pertes de swap: {e}")
            return {
                "slippage_percent": 0,
                "fees_percent": 0,
                "total_loss_percent": 0,
                "error": str(e)
            }

    async def get_token_price(self, token_mint: str) -> Optional[float]:
        """Get current token price directly from DexScreener"""
        try:
            dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(dexscreener_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        pairs = data.get('pairs', [])
                        if pairs:
                            # Use most liquid Solana pair
                            sol_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                            if sol_pairs:
                                best_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                                return float(best_pair.get('priceUsd', 0))
                            
            self.logger.error(f"Could not get price for {token_mint}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting token price: {str(e)}")
            return None

    def get_token_decimals(self, token_mint: str) -> int:
        """Get the number of decimals for a token"""
        # Known token decimals
        if token_mint == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v":  # USDC
            return 6
        elif token_mint == "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs":  # WETH
            self.logger.info(f"⚠️ Detected WETH token - using 8 decimals")
            return 8
        elif token_mint == "SWARMDNxdqrGBfnNAEfDVwsXz1JjdQjVyU4aQrRCLGn":  # SWARMS
            self.logger.info(f"⚠️ Detected SWARMS token - using 6 decimals")
            return 6
        else:
            # Try to get decimals from token account info first before defaulting
            try:
                # Check if we have a cached value from a previous balance check
                if hasattr(self, '_token_decimals_cache') and token_mint in self._token_decimals_cache:
                    decimals = self._token_decimals_cache[token_mint]
                    self.logger.info(f"Using cached decimals for {token_mint}: {decimals}")
                    return decimals
                
                self.logger.info(f"Default to 6 decimals for {token_mint} (safer than 9)")
                return 6
            except Exception as e:
                self.logger.warning(f"Error determining decimals: {e}, using 6 as safer default")
                return 6
            
    async def get_token_balance(self, token_mint: str) -> float:
        """Get token balance using Birdeye API"""
        try:
            # Get API key from environment
            api_key = os.getenv('BIRDEYE_API_KEY')
            if not api_key:
                raise ValueError("BIRDEYE_API_KEY not found in environment variables")

            # Prepare request
            url = "https://public-api.birdeye.so/v1/wallet/token_balance"
            headers = {
                'x-api-key': api_key,
                'x-chain': 'solana',
                'accept': 'application/json'
            }
            params = {
                'wallet': self.wallet_address,
                'token_address': token_mint
            }

            self.logger.info(f"Fetching balance for token {token_mint}")
            self.logger.info(f"Wallet address: {self.wallet_address}")

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.logger.debug(f"Birdeye API response: {json.dumps(data, indent=2)}")
                        
                        if data.get('success'):
                            token_data = data.get('data', {})
                            # Get balance and handle decimals (USDC has 6 decimals)
                            raw_balance = float(token_data.get('balance', 0))
                            decimals = int(token_data.get('decimals', 6))  # Default to 6 for USDC
                            
                            # Store the decimals in a cache for future reference
                            if not hasattr(self, '_token_decimals_cache'):
                                self._token_decimals_cache = {}
                            self._token_decimals_cache[token_mint] = decimals
                            self.logger.info(f"Cached {decimals} decimals for token {token_mint}")
                            
                            balance = raw_balance / (10 ** decimals)
                            
                            usd_value = float(token_data.get('usd_value', 0))
                            
                            self.logger.info(f"Token balance: {balance:.4f}")
                            self.logger.info(f"USD value: ${usd_value:.2f}")
                            self.logger.info(f"Raw balance: {raw_balance} (using {decimals} decimals)")
                            
                            return balance if balance > 0 else usd_value  # Return either balance or USD value
                        else:
                            self.logger.error(f"Birdeye API error: {data.get('message')}")
                    else:
                        self.logger.error(f"Birdeye API request failed: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")

                # If we get here, try fallback to DexScreener
                self.logger.info("Attempting fallback to DexScreener...")
                dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(dexscreener_url) as response:
                        if response.status == 200:
                            data = await response.json()
                            pairs = data.get('pairs', [])
                            if pairs:
                                best_pair = max(pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                                price = float(best_pair.get('priceUsd', 0))
                                self.logger.info(f"DexScreener price: ${price:.4f}")
                                return price
                
                return 0

        except Exception as e:
            self.logger.error(f"Error getting token balance from Birdeye: {e}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return 0

    async def get_jupiter_quote(
        self, 
        input_token: str, 
        output_token: str, 
        amount: int,  # Now expects raw amount
        is_raw: bool = True
    ) -> Optional[Dict]:
        """Get quote from Jupiter API v1"""
        try:
            base_url = "https://api.jup.ag/swap/v1/quote"
            params = {
                "inputMint": str(input_token),
                "outputMint": str(output_token),
                "amount": str(amount),  # Use raw amount directly
                "slippageBps": "100"
            }
            
            if os.getenv('JUPITER_API_KEY'):
                params["apiKey"] = os.getenv('JUPITER_API_KEY')
            
            url = f"{base_url}?{urllib.parse.urlencode(params)}"
            
            self.logger.info("\nJupiter Quote Request:")
            self.logger.info(f"URL: {url}")
            self.logger.info(f"Amount Raw: {amount}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")
                        return None
                        
                    data = await response.json()
                    
                    # Ensure the response has the required fields
                    required_fields = ['inputMint', 'outputMint', 'inAmount', 'outAmount', 'otherAmountThreshold', 'swapMode']
                    if not all(field in data for field in required_fields):
                        self.logger.error("Quote response missing required fields")
                        self.logger.debug(f"Response data: {json.dumps(data, indent=2)}")
                        return None
                    
                    return data
                    
        except Exception as e:
            self.logger.error(f"Error getting Jupiter quote: {str(e)}")
            if hasattr(e, '__traceback__'):
                import traceback
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def execute_validated_swap(
        self,
        input_token: str,
        output_token: str,
        amount: float,
        min_amount: float = 1.0,
        max_slippage: float = 1.0
    ) -> tuple[bool, Optional[bytes], Optional[dict]]:  # Ajout d'un troisième élément dans le tuple de retour
        """Execute swap with validation"""
        try:
            # Calculer la valeur USD correctement
            usd_value = amount
        
            # Si le token d'entrée n'est pas un stablecoin, obtenir son prix
            if input_token != "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" and input_token != "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB":  # Si ce n'est ni USDC ni USDT
                current_price = await self.get_token_price(input_token)
                if not current_price:
                    self.logger.error(f"Could not get price for {input_token}")
                    return False, None, None
                usd_value = amount * current_price
        
            self.logger.info(f"Trade value: ${usd_value:.2f} USD")

            # Validate trade first
            if usd_value < min_amount:
                self.logger.error(f"USD value ${usd_value:.2f} below minimum ${min_amount}")
                return False, None, None

            # Get token decimals using helper method
            decimals = self.get_token_decimals(input_token)
            self.logger.info(f"Using {decimals} decimals for token {input_token}")
            
            # Convert to raw amount with appropriate decimals
            amount_raw = int(amount * (10 ** decimals))

            self.logger.info(f"Converting amount {amount} to raw amount {amount_raw} (using {decimals} decimals)")
        
            # Get quote with raw token amount
            quote = await self.get_jupiter_quote(input_token, output_token, amount_raw, is_raw=True)
            if not quote:
                return False, None, None

            # Get transaction bytes
            transaction_bytes = await self.get_jupiter_transaction(quote, self.wallet_address)
            if not transaction_bytes:
                return False, None, None

            # Retourner également les données du quote
            return True, transaction_bytes, quote
            
        except Exception as e:
            self.logger.error(f"Validated swap failed: {e}")
            return False, None

    async def validate_trade(
        self,
        input_token: str,
        output_token: str,
        amount: float,
        min_amount: float = 1.0,
        max_slippage: float = 1.0
    ) -> bool:
        """Validate trade parameters before execution"""
        try:
            # Check minimum amount
            if amount < min_amount:
                self.logger.error(f"Amount {amount} below minimum {min_amount}")
                return False
                
            # Get and validate quote
            quote = await self.get_jupiter_quote(input_token, output_token, amount)
            if not quote:
                self.logger.error("Failed to get quote")
                return False
                
            # Check slippage
            if not await self.check_slippage(quote, max_slippage):
                return False
                
            self.logger.info("Trade validation passed")
            return True
            
        except Exception as e:
            self.logger.error(f"Trade validation failed: {e}")
            return False

    async def check_slippage(self, quote_data: dict, max_slippage: float = 1.0) -> bool:
        """Check if quote slippage is within acceptable range"""
        try:
            price_impact = float(quote_data.get('priceImpactPct', 0))
            
            if price_impact > max_slippage:
                self.logger.warning(f"Price impact {price_impact:.2f}% exceeds max slippage {max_slippage}%")
                return False
                
            self.logger.info(f"Price impact {price_impact:.2f}% within acceptable range")
            return True
            
        except Exception as e:
            self.logger.error(f"Error checking slippage: {e}")
            return False

    async def execute_trade_with_retries(self, transaction: Transaction, token_mint: str, quote_data: Optional[dict] = None, max_retries: int = 3) -> Optional[Dict]:
        # Store the last swap result for later analysis
        self._last_swap_result = None
        """Execute trade with balance confirmation via Birdeye API"""
        client = AsyncClient(
            "https://api.mainnet-beta.solana.com",
            commitment="confirmed"
        )
        try:
            for attempt in range(max_retries):
                try:
                    # Pour les achats, on vérifie la balance du token qu'on achète
                    # Pour les ventes, on vérifie la balance USDC
                    is_buy = token_mint != "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC mint
                    check_token = token_mint if is_buy else "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

                    url = "https://public-api.birdeye.so/v1/wallet/token_balance"
                    headers = {
                        'x-api-key': os.getenv('BIRDEYE_API_KEY'),
                        'x-chain': 'solana',
                        'accept': 'application/json'
                    }
                    params = {
                        'wallet': self.wallet_address,
                        'token_address': check_token
                    }

                    self.logger.info(f"\n🔍 Checking {'token' if is_buy else 'USDC'} balance")
                    self.logger.info(f"Wallet: {self.wallet_address}")
                    self.logger.info(f"Token: {check_token}")

                    async with aiohttp.ClientSession() as session:
                        async with session.get(url, headers=headers, params=params) as response:
                            response_text = await response.text()
                            self.logger.info(f"Response: {response_text}")
                            
                            if response.status == 200:
                                data = json.loads(response_text)
                                
                                # Si data est null, on considère la balance comme 0
                                if data.get('success') and data.get('data') is None:
                                    initial_balance = 0
                                    self.logger.info("No balance found, setting to 0")
                                else:
                                    balance_data = data.get('data', {})
                                    initial_balance = float(balance_data.get('balance', 0))
                                    
                                self.logger.info(f"Initial balance: {initial_balance}")

                                # Envoyer la transaction
                                result = await client.send_raw_transaction(
                                    bytes(transaction),
                                    opts=TxOpts(
                                        skip_preflight=True,
                                        max_retries=2,
                                        preflight_commitment="confirmed"
                                    )
                                )

                                if not result.value:
                                    self.logger.error("No transaction signature returned")
                                    continue

                                signature_str = str(result.value)
                                self.logger.info(f"Transaction sent: {signature_str}")

                                # Vérifier la nouvelle balance
                                success = False
                                final_balance = None
                                for _ in range(3):  # 3 tentatives de vérification
                                    await asyncio.sleep(8)
                                
                                    async with session.get(url, headers=headers, params=params) as check_response:
                                        if check_response.status == 200:
                                            check_data = await check_response.json()
                                        
                                            # Gérer le cas où data est null
                                            if check_data.get('success') and check_data.get('data') is None:
                                                new_balance = 0
                                            else:
                                                new_balance = float(check_data.get('data', {}).get('balance', 0))
                                            
                                            self.logger.info(f"New balance: {new_balance}")
                                            
                                            self.logger.info(f"Checking if balance changed: initial={initial_balance}, new={new_balance}")
                                            if new_balance != initial_balance:
                                                self.logger.info(f"✅ Balance changed! From {initial_balance} to {new_balance}")
                                                success = True
                                                final_balance = new_balance
                                                break
                                            else:
                                                self.logger.info(f"⏳ No balance change detected yet ({initial_balance} → {new_balance})")
                                                self.logger.info("Balance not yet updated, waiting 8 seconds...")

                                if success:
                                    result = {
                                        'signature': signature_str,
                                        'initial_balance': initial_balance,
                                        'final_balance': final_balance,
                                        'amount': final_balance - initial_balance if is_buy else initial_balance - final_balance
                                    }
                                    
                                    # Ajouter ce code pour calculer et enregistrer les pertes
                                    try:
                                        # Récupérer les données du quote si disponibles
                                        if quote_data:
                                            # Pour les achats (BUY), le token d'entrée est USDC et le token de sortie est le token acheté
                                            # Pour les ventes (SELL), c'est l'inverse
                                            if is_buy:
                                                input_token = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
                                                output_token = token_mint
                                                input_amount = initial_balance - final_balance  # USDC dépensé
                                                output_amount = result['amount']  # Tokens reçus
                                            else:
                                                input_token = token_mint  # Token vendu
                                                output_token = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
                                                input_amount = result['amount']  # Tokens vendus
                                                output_amount = final_balance - initial_balance  # USDC reçu
                                            
                                            # Calculer les pertes
                                            loss_analysis = await self.calculate_swap_losses(
                                                quote_data,
                                                input_amount,
                                                output_amount
                                            )
                                            
                                            # Ajouter les informations de perte au résultat
                                            result['swap_analysis'] = loss_analysis
                                    
                                            # Store the result for later use
                                            self._last_swap_result = result
                                            
                                            # Journaliser un résumé
                                            self.logger.info(f"\n💰 Résumé du swap:")
                                            self.logger.info(f"Perte totale: {loss_analysis['total_loss_percent']:.2f}%")
                                            self.logger.info(f"Slippage: {loss_analysis['slippage_percent']:.2f}%")
                                            self.logger.info(f"Frais: {loss_analysis['fees_percent']:.2f}%")
                                        else:
                                            self.logger.warning("Données du quote non disponibles pour l'analyse des pertes")
                                    except Exception as e:
                                        self.logger.error(f"Erreur lors de l'analyse des pertes: {e}")
                                        # Ne pas bloquer l'exécution en cas d'erreur dans l'analyse
                                    
                                    # Send trade notification only for Take Profit trades
                                    try:
                                        # Check if this is a Take Profit trade
                                        is_take_profit = False
                                        
                                        # Try to determine if this is a Take Profit trade
                                        # For now, we'll consider any SELL trade as potentially a Take Profit
                                        if not is_buy:  # SELL trades
                                            # You might want to add additional logic here to confirm it's actually a Take Profit
                                            # For example, checking trade reason or other metadata if available
                                            is_take_profit = True
                                        
                                        if is_take_profit:
                                            from utils.send_sse import send_trade_notification
                                            
                                            # Get current price for the token
                                            token_price = 0
                                            try:
                                                # Try to get price from DexScreener
                                                dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{check_token}"
                                                async with aiohttp.ClientSession() as price_session:
                                                    async with price_session.get(dexscreener_url) as price_response:
                                                        if price_response.status == 200:
                                                            price_data = await price_response.json()
                                                            pairs = price_data.get('pairs', [])
                                                            if pairs:
                                                                sol_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                                                                if sol_pairs:
                                                                    best_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                                                                    token_price = float(best_pair.get('priceUsd', 0))
                                            except Exception as price_err:
                                                self.logger.error(f"Error getting token price: {price_err}")
                                                # Continue with token_price = 0
                                            
                                            trade_notification = {
                                                'token': check_token,
                                                'type': 'SELL',  # Take Profit is always a SELL
                                                'price': token_price,
                                                'amount': result['amount'],
                                                'value': result['amount'] * token_price,
                                                'status': 'COMPLETED',
                                                'id': signature_str,
                                                'reason': 'TAKE_PROFIT'  # Add reason to indicate it's a Take Profit
                                            }
                                            
                                            # Try to send notification but handle failure gracefully
                                            try:
                                                notification_sent = send_trade_notification(trade_notification)
                                                if notification_sent:
                                                    self.logger.info("✅ Take Profit notification sent successfully")
                                                else:
                                                    self.logger.warning("⚠️ Failed to send Take Profit notification, but continuing")
                                            except Exception as notify_err:
                                                self.logger.warning(f"⚠️ Error sending notification, but continuing: {notify_err}")
                                        else:
                                            self.logger.info("Not a Take Profit trade, skipping notification")
                                    except ImportError:
                                        self.logger.warning("⚠️ send_trade_notification not available, skipping notification")
                                    except Exception as e:
                                        self.logger.warning(f"⚠️ Failed to process trade notification, but continuing: {e}")
                                    
                                    return result
                                
                                # Si on arrive ici, c'est qu'on n'a pas confirmé la balance après 3 tentatives
                                self.logger.warning("Balance check timeout, moving to next attempt")
                                
                                # Try to send a notification about the pending Take Profit trade
                                try:
                                    # Only send for Take Profit trades (SELL trades)
                                    if not is_buy:
                                        from utils.send_sse import send_trade_notification
                                        
                                        # Get current price for the token
                                        token_price = 0
                                        try:
                                            # Try to get price from DexScreener
                                            dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{token_mint}"
                                            async with aiohttp.ClientSession() as price_session:
                                                async with price_session.get(dexscreener_url) as price_response:
                                                    if price_response.status == 200:
                                                        price_data = await price_response.json()
                                                        pairs = price_data.get('pairs', [])
                                                        if pairs:
                                                            sol_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                                                            if sol_pairs:
                                                                best_pair = max(sol_pairs, key=lambda x: float(x.get('liquidity', {}).get('usd', 0) or 0))
                                                                token_price = float(best_pair.get('priceUsd', 0))
                                        except Exception as price_err:
                                            self.logger.error(f"Error getting token price: {price_err}")
                                            
                                        # Use estimated amount based on transaction data
                                        estimated_amount = 0
                                        if 'initial_balance' in locals():
                                            # Rough estimate based on initial balance
                                            estimated_amount = initial_balance * 0.1  # Assume using 10% of balance
                                            
                                        trade_notification = {
                                            'token': token_mint,
                                            'type': 'SELL',
                                            'price': token_price,
                                            'amount': estimated_amount,
                                            'status': 'PENDING',
                                            'id': signature_str,
                                            'reason': 'TAKE_PROFIT'
                                        }
                                        
                                        # Try to send notification but handle failure gracefully
                                        try:
                                            notification_sent = send_trade_notification(trade_notification)
                                            if notification_sent:
                                                self.logger.info("✅ Pending Take Profit notification sent successfully")
                                            else:
                                                self.logger.warning("⚠️ Failed to send pending Take Profit notification, but continuing")
                                        except Exception as notify_err:
                                            self.logger.warning(f"⚠️ Error sending notification, but continuing: {notify_err}")
                                    else:
                                        self.logger.info("Not a Take Profit trade, skipping pending notification")
                                except ImportError:
                                    self.logger.warning("⚠️ send_trade_notification not available, skipping notification")
                                except Exception as e:
                                    self.logger.warning(f"⚠️ Failed to process pending trade notification, but continuing: {e}")

                except Exception as e:
                    self.logger.error(f"Attempt {attempt + 1} failed: {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2)
                        continue

            return None
            
        except Exception as e:
            self.logger.error(f"Failed to execute transaction: {e}")
            return None
            
        finally:
            await client.close()

    async def get_jupiter_transaction(self, quote_data: dict, wallet_address: str) -> Optional[bytes]:
        """Get swap transaction from Jupiter v1 API with optimizations"""
        try:
            url = "https://api.jup.ag/swap/v1/swap"
            
            # Ensure quote_data has all required fields
            if not all(key in quote_data for key in ['inputMint', 'outputMint', 'inAmount', 'outAmount', 'otherAmountThreshold', 'swapMode']):
                self.logger.error("Missing required fields in quote data")
                self.logger.debug(f"Quote data: {json.dumps(quote_data, indent=2)}")
                return None

            # Construct the request body according to v1 API spec
            swap_data = {
                "quoteResponse": {
                    "inputMint": quote_data["inputMint"],
                    "inAmount": quote_data["inAmount"],
                    "outputMint": quote_data["outputMint"],
                    "outAmount": quote_data["outAmount"],
                    "otherAmountThreshold": quote_data["otherAmountThreshold"],
                    "swapMode": quote_data["swapMode"],
                    "slippageBps": quote_data.get("slippageBps", 100),
                    "platformFee": quote_data.get("platformFee", None),
                    "priceImpactPct": quote_data.get("priceImpactPct", "0"),
                    "routePlan": quote_data.get("routePlan", []),
                    "contextSlot": quote_data.get("contextSlot", 0),
                    "timeTaken": quote_data.get("timeTaken", 0)
                },
                "userPublicKey": wallet_address,
                "wrapAndUnwrapSol": True,
                "useSharedAccounts": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "priorityLevel": "medium",
                        "maxLamports": 10000000
                    }
                }
            }

            # Add API key if available
            if os.getenv('JUPITER_API_KEY'):
                swap_data["trackingAccount"] = os.getenv('JUPITER_API_KEY')
            
            self.logger.info("Requesting optimized swap transaction...")
            self.logger.debug(f"Swap parameters: {json.dumps(swap_data, indent=2)}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url, 
                    json=swap_data,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if not response.ok:
                        self.logger.error(f"Jupiter API error: {response.status}")
                        self.logger.error(f"Response: {await response.text()}")
                        return None
                
                    try:
                        transaction_data = await response.json()
                    except json.JSONDecodeError as e:
                        self.logger.error(f"Invalid JSON response: {e}")
                        return None
                
                    # Get the base64 encoded transaction
                    transaction_base64 = transaction_data.get('swapTransaction')
                    if not transaction_base64:
                        self.logger.error("No transaction data in response")
                        return None

                    try:
                        transaction_bytes = base64.b64decode(transaction_base64)
                        self.logger.info(f"Transaction bytes length: {len(transaction_bytes)}")
                        return transaction_bytes
                        
                    except Exception as e:
                        self.logger.error(f"Invalid transaction format: {e}")
                        return None

        except Exception as e:
            self.logger.error(f"Error getting swap transaction: {e}")
            if hasattr(e, '__traceback__'):
                traceback.print_tb(e.__traceback__)
            return None

    async def prepare_transaction(self, transaction_bytes: bytes) -> Optional[Transaction]:
        """Prepare a versioned transaction by recompiling with fresh blockhash"""
        try:
            # Create client with correct configuration
            client = AsyncClient(
                "https://api.mainnet-beta.solana.com", 
                commitment="confirmed"
            )
            
            try:
                # Get fresh blockhash
                blockhash_response = await client.get_latest_blockhash(
                    commitment=Commitment("confirmed")
                )
                if not blockhash_response or not blockhash_response.value:
                    raise Exception("Failed to get recent blockhash")
                
                fresh_blockhash = blockhash_response.value.blockhash
                self.logger.info(f"Got fresh blockhash: {fresh_blockhash}")

                # Deserialize and rebuild transaction
                original_tx = VersionedTransaction.from_bytes(transaction_bytes)
                message = original_tx.message
                
                # Create new message with fresh blockhash
                new_message = MessageV0(
                    header=message.header,
                    account_keys=message.account_keys,
                    recent_blockhash=fresh_blockhash,
                    instructions=message.instructions,
                    address_table_lookups=message.address_table_lookups
                )
                
                # Create new transaction with keypair
                new_transaction = VersionedTransaction(
                    message=new_message,
                    keypairs=[self.wallet_keypair]
                )
            
                self.logger.info("Successfully prepared versioned transaction")
                return new_transaction

            finally:
                await client.close()

        except Exception as e:
            self.logger.error(f"Error in prepare_transaction: {e}")
            if hasattr(e, '__traceback__'):
                self.logger.error("Traceback:")
                traceback.print_tb(e.__traceback__)
            return None

    async def get_last_swap_analysis(self) -> Optional[Dict]:
        """Return the last swap result with analysis"""
        return self._last_swap_result

if __name__ == "__main__":
    print("This module is not meant to be run directly")
