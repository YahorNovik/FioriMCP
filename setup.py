#!/usr/bin/env python3
"""
Setup script for Fiori Testing Agent
"""

import os
import sys

def check_openai_key():
    """Check if OpenAI API key is set"""
    key = os.getenv("OPENAI_API_KEY")
    if key:
        print(f"✅ OpenAI API key is set: {key[:10]}...")
        return True
    else:
        print("❌ OpenAI API key not found")
        return False

def setup_environment():
    """Help user set up environment"""
    print("🔧 Environment Setup")
    print("=" * 30)
    
    # Check OpenAI key
    if not check_openai_key():
        print("\n📝 To set your OpenAI API key:")
        print("1. Get your API key from: https://platform.openai.com/api-keys")
        print("2. Set it using one of these methods:")
        print()
        print("   PowerShell:")
        print('   $env:OPENAI_API_KEY="sk-your-key-here"')
        print()
        print("   Command Prompt:")
        print('   set OPENAI_API_KEY=sk-your-key-here')
        print()
        print("   Or create a .env file with:")
        print('   OPENAI_API_KEY=sk-your-key-here')
        print()
        
        # Ask user to set it
        key = input("Enter your OpenAI API key (or press Enter to skip): ").strip()
        if key:
            os.environ["OPENAI_API_KEY"] = key
            print("✅ API key set for this session")
            return True
        else:
            print("⚠️ Skipping API key setup")
            return False
    
    return True

def check_mcp_server():
    """Check if MCP server is running"""
    try:
        import requests
        response = requests.get("http://localhost:3000/health", timeout=5)
        if response.status_code == 200:
            print("✅ MCP server is running")
            return True
        else:
            print("❌ MCP server responded with error")
            return False
    except:
        print("❌ MCP server is not running")
        print("   Start it with: node generated-fiori-mcp-http-server.js")
        return False

def check_dependencies():
    """Check if required packages are installed"""
    print("📦 Checking dependencies...")
    
    required_packages = [
        "langchain",
        "langchain_openai", 
        "langgraph",
        "openai",
        "requests"
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package}")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n📥 Install missing packages:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def main():
    """Main setup function"""
    print("🤖 Fiori Testing Agent Setup")
    print("=" * 40)
    
    # Check dependencies
    deps_ok = check_dependencies()
    
    # Check MCP server
    mcp_ok = check_mcp_server()
    
    # Setup environment
    env_ok = setup_environment()
    
    print("\n📊 Setup Summary:")
    print(f"Dependencies: {'✅' if deps_ok else '❌'}")
    print(f"MCP Server: {'✅' if mcp_ok else '❌'}")
    print(f"Environment: {'✅' if env_ok else '❌'}")
    
    if deps_ok and mcp_ok and env_ok:
        print("\n🎉 Setup complete! You can now run:")
        print("   python run_tests.py")
        print("   python demo.py")
    else:
        print("\n⚠️ Please fix the issues above before running tests")
        sys.exit(1)

if __name__ == "__main__":
    main()
