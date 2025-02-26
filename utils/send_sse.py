"""
Server-Sent Events (SSE) notification sender for KinKong Copilot.
This module handles sending notifications to the server, which then broadcasts to connected clients.
"""

import os
import json
import requests
import logging
from typing import Dict, Any, Optional
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

def send_signal_notification(signal_data: Dict[str, Any]) -> bool:
    """
    Send a signal notification to the server for broadcasting to KinKong Copilot clients.
    
    Args:
        signal_data: Dictionary containing signal information
        
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    try:
        # Get the notification endpoint from environment variable or use default
        notification_endpoint = os.getenv('NOTIFICATION_ENDPOINT', 'https://swarmtrade.ai/api/notifications/broadcast')
        
        # Get API key for authentication
        api_key = os.getenv('NOTIFICATION_API_KEY')
        if not api_key:
            logger.error("NOTIFICATION_API_KEY not found in environment variables")
            return False
        
        # Format the notification data
        notification = {
            "type": "SIGNAL",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "token": signal_data.get('token', ''),
                "signalType": signal_data.get('type', ''),
                "timeframe": signal_data.get('timeframe', ''),
                "confidence": signal_data.get('confidence', ''),
                "entryPrice": signal_data.get('entryPrice', 0),
                "targetPrice": signal_data.get('targetPrice', 0),
                "stopLoss": signal_data.get('stopLoss', 0),
                "reasoning": signal_data.get('reasoning', '')[:100] + '...' if signal_data.get('reasoning') and len(signal_data.get('reasoning')) > 100 else signal_data.get('reasoning', ''),
                "signalId": signal_data.get('id', '')
            }
        }
        
        # Send the notification to the server
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        logger.info(f"Sending signal notification for {notification['data']['token']}")
        response = requests.post(
            notification_endpoint,
            headers=headers,
            json=notification,
            timeout=10  # 10 second timeout
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Signal notification sent successfully")
            return True
        else:
            logger.error(f"❌ Failed to send notification: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending signal notification: {e}")
        return False

def send_price_alert(token: str, price: float, change_percent: float) -> bool:
    """
    Send a price alert notification to all connected KinKong Copilot clients.
    
    Args:
        token: Token symbol
        price: Current price
        change_percent: Price change percentage
        
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    try:
        # Get the notification endpoint from environment variable or use default
        notification_endpoint = os.getenv('NOTIFICATION_ENDPOINT', 'https://swarmtrade.ai/api/notifications/broadcast')
        
        # Get API key for authentication
        api_key = os.getenv('NOTIFICATION_API_KEY')
        if not api_key:
            logger.error("NOTIFICATION_API_KEY not found in environment variables")
            return False
        
        # Format the notification data
        notification = {
            "type": "PRICE_ALERT",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "token": token,
                "price": price,
                "changePercent": change_percent,
                "direction": "UP" if change_percent > 0 else "DOWN"
            }
        }
        
        # Send the notification to the server
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        logger.info(f"Sending price alert for {token} at ${price:.6f} ({change_percent:+.2f}%)")
        response = requests.post(
            notification_endpoint,
            headers=headers,
            json=notification,
            timeout=10  # 10 second timeout
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Price alert sent successfully")
            return True
        else:
            logger.error(f"❌ Failed to send price alert: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending price alert: {e}")
        return False

def send_trade_notification(trade_data: Dict[str, Any]) -> bool:
    """
    Send a trade notification to all connected KinKong Copilot clients.
    
    Args:
        trade_data: Dictionary containing trade information
        
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    try:
        # Get the notification endpoint from environment variable or use default
        notification_endpoint = os.getenv('NOTIFICATION_ENDPOINT', 'https://swarmtrade.ai/api/notifications/broadcast')
        
        # Get API key for authentication
        api_key = os.getenv('NOTIFICATION_API_KEY')
        if not api_key:
            logger.error("NOTIFICATION_API_KEY not found in environment variables")
            return False
        
        # Format the notification data
        notification = {
            "type": "TRADE",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "token": trade_data.get('token', ''),
                "action": trade_data.get('type', ''),
                "price": trade_data.get('price', 0),
                "amount": trade_data.get('amount', 0),
                "value": trade_data.get('value', 0),
                "status": trade_data.get('status', ''),
                "tradeId": trade_data.get('id', ''),
                "reason": trade_data.get('reason', '')  # Include reason field
            }
        }
        
        # Send the notification to the server
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        logger.info(f"Sending trade notification for {notification['data']['token']}")
        
        try:
            response = requests.post(
                notification_endpoint,
                headers=headers,
                json=notification,
                timeout=10  # 10 second timeout
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Trade notification sent successfully")
                return True
            else:
                logger.error(f"❌ Failed to send trade notification: {response.status_code} - {response.text}")
                # Retry once for server errors (500+)
                if response.status_code >= 500:
                    logger.info("Retrying notification due to server error...")
                    retry_response = requests.post(
                        notification_endpoint,
                        headers=headers,
                        json=notification,
                        timeout=15  # Longer timeout for retry
                    )
                    if retry_response.status_code == 200:
                        logger.info(f"✅ Trade notification sent successfully on retry")
                        return True
                return False
        except requests.exceptions.Timeout:
            logger.error("❌ Trade notification request timed out")
            return False
        except requests.exceptions.ConnectionError:
            logger.error("❌ Connection error when sending trade notification")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Request exception when sending trade notification: {e}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending trade notification: {e}")
        return False
