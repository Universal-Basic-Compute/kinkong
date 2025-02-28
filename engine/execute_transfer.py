#!/usr/bin/env python3
import os
import sys
import json
import time
import base58
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv
from airtable import Airtable

def setup_logging():
    """Set up basic logging configuration"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    return logging.getLogger('execute_transfer')

class UBCTransferExecutor:
    def __init__(self):
        load_dotenv()
        self.logger = setup_logging()
        
        # Initialize Airtable
        self.base_id = os.getenv('KINKONG_AIRTABLE_BASE_ID')
        self.api_key = os.getenv('KINKONG_AIRTABLE_API_KEY')
        
        if not self.base_id or not self.api_key:
            raise ValueError("Missing Airtable credentials in environment variables")
        
        # Initialize Airtable tables
        self.redistributions_table = Airtable(
            self.base_id,
            'REDISTRIBUTIONS',
            self.api_key
        )
        
        self.investor_redistributions_table = Airtable(
            self.base_id,
            'INVESTOR_REDISTRIBUTIONS',
            self.api_key
        )
        
        # Initialize Helius RPC URL
        self.rpc_url = os.getenv('NEXT_PUBLIC_HELIUS_RPC_URL', 'https://api.mainnet-beta.solana.com')
        
        # UBC token mint address
        self.ubc_mint = "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump"
        
        # Load wallet from private key
        private_key_str = os.getenv('KINKONG_WALLET_PRIVATE_KEY')
        if not private_key_str:
            raise ValueError("KINKONG_WALLET_PRIVATE_KEY not found in environment variables")
        
        # Store private key for later use
        self.private_key = private_key_str
        
        # Get wallet address
        try:
            # Use KINKONG_WALLET environment variable
            self.wallet = os.getenv('KINKONG_WALLET')
            if not self.wallet:
                raise ValueError("KINKONG_WALLET not found in environment variables")
            
            self.logger.info(f"Wallet loaded: {self.wallet}")
        except Exception as e:
            self.logger.error(f"Error loading wallet: {e}")
            raise ValueError(f"Invalid wallet configuration: {e}")
    
    
    def get_pending_redistributions(self):
        """Get pending redistributions from Airtable"""
        try:
            # Get pending main redistributions
            pending_redistributions = self.redistributions_table.get_all(
                formula="AND({status}='PENDING', {totalUbcAmount}>0)"
            )
            
            self.logger.info(f"Found {len(pending_redistributions)} pending redistributions")
            
            if not pending_redistributions:
                return []
            
            # Process each redistribution
            processed_redistributions = []
            
            for redistribution in pending_redistributions:
                redistribution_id = redistribution['id']
                
                # Get investor redistributions for this main redistribution
                investor_redistributions = self.investor_redistributions_table.get_all(
                    formula=f"AND({{redistributionId}}='{redistribution_id}', {{status}}='PENDING')"
                )
                
                self.logger.info(f"Found {len(investor_redistributions)} pending investor redistributions for {redistribution_id}")
                
                # Process investor redistributions
                processed_investors = []
                
                for investor in investor_redistributions:
                    try:
                        wallet = investor['fields'].get('wallet')
                        ubc_amount = float(investor['fields'].get('ubcAmount', 0))
                        
                        if not wallet or ubc_amount <= 0:
                            self.logger.warning(f"Invalid investor redistribution: {investor['id']} - Missing wallet or zero amount")
                            continue
                        
                        processed_investors.append({
                            'id': investor['id'],
                            'wallet': wallet,
                            'ubcAmount': ubc_amount
                        })
                    except Exception as e:
                        self.logger.error(f"Error processing investor redistribution {investor['id']}: {e}")
                
                # Add to processed redistributions
                processed_redistributions.append({
                    'id': redistribution_id,
                    'totalUbcAmount': float(redistribution['fields'].get('totalUbcAmount', 0)),
                    'investors': processed_investors
                })
            
            return processed_redistributions
        except Exception as e:
            self.logger.error(f"Error getting pending redistributions: {e}")
            return []
    
    
    def execute_transfer(self, destination_wallet, ubc_amount):
        """Execute a UBC transfer to the destination wallet using Helius API"""
        try:
            # For UBC, we'll use 6 decimals (standard for most SPL tokens)
            decimals = 6
            amount_lamports = int(ubc_amount * (10 ** decimals))
            
            # Verify the conversion is correct by doing the reverse calculation
            reverse_check = amount_lamports / (10 ** decimals)
            if abs(reverse_check - ubc_amount) > 0.000001:  # Allow for small floating point differences
                self.logger.warning(f"UBC amount conversion verification failed: {ubc_amount} vs {reverse_check}")
                
            self.logger.info(f"Preparing to transfer {ubc_amount} UBC ({amount_lamports} lamports) to {destination_wallet}")
            self.logger.info(f"Token decimals: {decimals}")
            
            # Use Helius API to execute the transfer
            helius_api_key = os.getenv('HELIUS_API_KEY')
            if not helius_api_key:
                raise ValueError("HELIUS_API_KEY not found in environment variables")
            
            # Construct the transfer transaction using Helius API
            helius_url = f"https://api.helius.xyz/v0/transactions/send?api-key={helius_api_key}"
            
            # Prepare the transaction payload
            payload = {
                "token": self.ubc_mint,
                "amount": amount_lamports,
                "to": destination_wallet,
                "from": self.wallet,
                "type": "token-transfer",
                "options": {
                    "commitment": "confirmed"
                }
            }
            
            # Send the transaction
            self.logger.info(f"Sending transaction to Helius API")
            response = requests.post(helius_url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                tx_signature = result.get('signature')
                
                if tx_signature:
                    self.logger.info(f"Transaction sent successfully: {tx_signature}")
                    
                    # Wait for confirmation
                    self.logger.info("Waiting for transaction confirmation...")
                    time.sleep(5)  # Simple wait for confirmation
                    
                    return {
                        "success": True,
                        "signature": tx_signature
                    }
                else:
                    self.logger.error(f"No transaction signature in response: {result}")
                    return {
                        "success": False,
                        "error": "No transaction signature in response"
                    }
            else:
                self.logger.error(f"Failed to send transaction: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"Failed to send transaction: {response.text}"
                }
        except Exception as e:
            self.logger.error(f"Error executing transfer to {destination_wallet}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def update_redistribution_status(self, redistribution_id, status, notes=None):
        """Update the status of a redistribution in Airtable"""
        try:
            fields = {
                "status": status,
                "processedAt": datetime.now(timezone.utc).isoformat()
            }
            
            if notes:
                fields["notes"] = notes
            
            self.redistributions_table.update(redistribution_id, fields)
            self.logger.info(f"Updated redistribution {redistribution_id} status to {status}")
            return True
        except Exception as e:
            self.logger.error(f"Error updating redistribution status: {e}")
            return False
    
    def update_investor_redistribution_status(self, investor_id, status, tx_signature=None):
        """Update the status of an investor redistribution in Airtable"""
        try:
            fields = {
                "status": status,
                "processedAt": datetime.now(timezone.utc).isoformat()
            }
            
            if tx_signature:
                fields["txSignature"] = tx_signature
            
            self.investor_redistributions_table.update(investor_id, fields)
            self.logger.info(f"Updated investor redistribution {investor_id} status to {status}")
            return True
        except Exception as e:
            self.logger.error(f"Error updating investor redistribution status: {e}")
            return False
    
    def send_telegram_notification(self, investor_data, tx_signature):
        """Send a Telegram notification for a completed transfer"""
        try:
            self.logger.info(f"Sending Telegram notification for investor: {investor_data['wallet']}")
            
            # Get Telegram bot token and use the specified channel ID
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            chat_id = "-1001699255893"  # Use the specified channel ID
            
            if not bot_token:
                self.logger.warning("Telegram bot token not found in environment variables")
                return False
            
            # Format wallet address for display
            wallet = investor_data['wallet']
            if len(wallet) > 20:
                wallet_display = wallet[:10] + '...' + wallet[-10:]
            else:
                wallet_display = wallet
            
            # Create message text
            message = f"""🎉 *KinKong Profit Redistribution Completed*
            
📊 *Investor*: `{wallet_display}`
🪙 *UBC Amount*: {investor_data['ubcAmount']:.2f} UBC
✅ *Status*: Completed

🔗 [View Transaction](https://solscan.io/tx/{tx_signature})
"""
            
            # Send the text message
            telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }
            
            response = requests.post(telegram_url, json=payload)
            response.raise_for_status()
            
            self.logger.info(f"Telegram notification sent successfully for {wallet_display}")
            return True
        except Exception as e:
            self.logger.error(f"Error sending Telegram notification: {e}")
            return False
    
    def process_redistributions(self):
        """Process all pending redistributions"""
        try:
            # Get pending redistributions
            redistributions = self.get_pending_redistributions()
            
            if not redistributions:
                self.logger.info("No pending redistributions to process")
                return
            
            self.logger.info(f"Processing {len(redistributions)} redistributions")
            
            # Process each redistribution
            for redistribution in redistributions:
                redistribution_id = redistribution['id']
                total_ubc_amount = redistribution['totalUbcAmount']
                investors = redistribution['investors']
                
                self.logger.info(f"Processing redistribution {redistribution_id} with {len(investors)} investors")
                self.logger.info(f"Total UBC amount: {total_ubc_amount}")
                
                # Update main redistribution status to PROCESSING
                self.update_redistribution_status(redistribution_id, "PROCESSING")
                
                # Track success and failures
                successful_transfers = 0
                failed_transfers = 0
                
                # Sort investors by UBC amount (ascending - smallest first)
                sorted_investors = sorted(investors, key=lambda x: x['ubcAmount'])
                
                # Process each investor
                for investor in sorted_investors:
                    investor_id = investor['id']
                    wallet = investor['wallet']
                    ubc_amount = investor['ubcAmount']
                    
                    self.logger.info(f"Processing transfer of {ubc_amount} UBC to {wallet}")
                    
                    # Execute transfer
                    result = self.execute_transfer(wallet, ubc_amount)
                    
                    if result["success"]:
                        # Update investor redistribution status to COMPLETED
                        self.update_investor_redistribution_status(investor_id, "COMPLETED", result["signature"])
                        
                        # Send Telegram notification
                        self.send_telegram_notification(investor, result["signature"])
                        
                        successful_transfers += 1
                    else:
                        # Update investor redistribution status to FAILED
                        self.update_investor_redistribution_status(investor_id, "FAILED")
                        failed_transfers += 1
                    
                    # Wait 5 seconds between transfers
                    if investor != sorted_investors[-1]:  # Don't wait after the last transfer
                        self.logger.info("Waiting 5 seconds before next transfer...")
                        time.sleep(5)
                
                # Update main redistribution status based on results
                if failed_transfers == 0:
                    self.update_redistribution_status(redistribution_id, "COMPLETED", 
                                                     f"All {successful_transfers} transfers completed successfully")
                elif successful_transfers == 0:
                    self.update_redistribution_status(redistribution_id, "FAILED", 
                                                     f"All {failed_transfers} transfers failed")
                else:
                    self.update_redistribution_status(redistribution_id, "PARTIAL", 
                                                     f"{successful_transfers} transfers completed, {failed_transfers} failed")
                
                self.logger.info(f"Completed redistribution {redistribution_id}: {successful_transfers} successful, {failed_transfers} failed")
        except Exception as e:
            self.logger.error(f"Error processing redistributions: {e}")

def main():
    try:
        # Verify environment variables
        required_vars = [
            'KINKONG_AIRTABLE_BASE_ID',
            'KINKONG_AIRTABLE_API_KEY',
            'KINKONG_WALLET_PRIVATE_KEY',
            'KINKONG_WALLET',
            'NEXT_PUBLIC_HELIUS_RPC_URL',
            'HELIUS_API_KEY',
            'TELEGRAM_BOT_TOKEN'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")
        
        # Initialize and run transfer executor
        executor = UBCTransferExecutor()
        executor.process_redistributions()
        
        print("\n✅ Redistribution transfers completed")
        
    except Exception as e:
        print(f"\n❌ Script failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
