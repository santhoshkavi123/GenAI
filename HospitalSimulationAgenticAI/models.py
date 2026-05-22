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



# Gender Prediction Using Pre-Trained Model from Hugging Face
def GenderPredictionFromPreTrainedModel(image, image_processor, model) -> int:
    """
        Function : Function used to generate gender prediction using pretrained huggingface model

        Arguments :
            image: Input Image
            image_processor: PreTrained Processor 
            model : PreTrained Model
    """
    # Prepare the image for the model
    inputs = image_processor(images = image, return_tensors = 'pt')

    # Generate predictions
    outputs = model(**inputs)
    logits = outputs.logits
    predicted_class = logits.argmax(-1).item()

    # Map the prediction to the class
    classes = model.config.id2label
    gender_label = classes[predicted_class]

    print(f"Gender Prediction using Pre-Trained Model : {gender_label}")

    return gender_label 


# Age Prediction Using Pre-Trained Model from Hugging Face
def AgePredictionForPretrainedModel(image, age_model, age_model_processor):
    """
        Function : We are gonna pretrained Model for predicting the age 

        Arguments :
            image : Input Image 
            age_model_processor : Pass the pretrained processor from the huggingface 
            age_model : Pass the pretrained model from the huggingface
    """
    # Prepare the image for the model consumption
    inputs = age_model_processor(image, return_tensors = 'pt')

    # Generate Predictions
    outputs = age_model(**inputs)
    logits = outputs.logits
    predicted_class = logits.argmax(-1).item()


    # Map the prediction to the class label 
    classes = age_model.config.id2label
    age_prediction_class =classes[predicted_class]
    print(f"Age Prediction to the Class: {age_prediction_class}")

    return age_prediction_class