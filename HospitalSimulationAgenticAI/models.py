# import required libraries
from dotenv import load_dotenv
load_dotenv() # this loads the environment variables 
from langchain.chat_models import init_chat_model
from IPython.display import display, Markdown

# Gemini Model
def gemini_model(input_text:str) -> str:
    "Function calling Gemini Model"
    gemini_model =  init_chat_model(model = 'gemini-3.5-flash', 
                                model_provider='google-genai')

    # Adjust LLM parameters (if supported)
    gemini_model.temperature = 0.9 # Increase randomness
    response = gemini_model.invoke(input_text)
    return response 

