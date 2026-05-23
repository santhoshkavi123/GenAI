import os
import operator
import functools
import warnings
warnings.filterwarnings('ignore')
from IPython.display import display, Markdown

# Loading the environment variablese
from dotenv import load_dotenv
load_dotenv()


from langchain_aws import ChatBedrockConverse
from langchain_classic.memory import ConversationSummaryBufferMemory
from langchain_classic.chains import ConversationChain


# 1. Initializing the LLM from AWS Bedrock Service using LangChain
def demo_chatbot():
    # let's use meta 8B model meta.llama3-1-8b-instruct-v1:0
    llm_model = ChatBedrockConverse(
        credentials_profile_name = 'default', 
        model = 'us.meta.llama3-1-8b-instruct-v1:0', 
        temperature = 0.1, 
        max_tokens = 1000
    )

    return llm_model

# 2. Initializing the ConversationalSummaryBufferMemory 
def demo_memory():
    llm_data = demo_chatbot()
    memory = ConversationSummaryBufferMemory(
      llm = llm_data, 
      max_token_limit = 2000  
    )

    return memory


# 3. Initializing the ConversationChain
def demo_conversation(input_text, memory):
    llm_chain_data = demo_chatbot()
    llm_conversation = ConversationChain(
        llm = llm_chain_data, 
        memory = memory, 
        verbose = True
    )

    # Chat Response using invoke 
    chat_reply = llm_conversation.invoke(input_text)
    return chat_reply['response']


if __name__ == "__main__":
    message = [
        {
            'role':'user', 
            'content':[{
                'text': "Good to see how are you doing today?"
            }]
        
        }
    ]

    memory = demo_memory()

    # Conversation Chain
    output = demo_conversation(message, memory)
    print(output)
    