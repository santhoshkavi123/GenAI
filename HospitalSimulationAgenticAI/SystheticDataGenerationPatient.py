# This is the code for generating synthetic patient data using LLM
from models import gemini_model
from typing import List
import pandas as pd
from IPython.display import display, Markdown
from langchain_core.prompts.chat import ChatPromptTemplate
from langchain_classic.output_parsers.structured import (StructuredOutputParser, 
                                                         ResponseSchema)
from langchain_core.output_parsers.json import JsonOutputParser                                                         



class GeneratePatientData:
    """
        Function : This function contains different methods which help to generate the synthetic patient data

        Methods :
            structured_output_format : This method generates a structure output parser and format instructions that let's llm to generate its 
                                        response in that format 

            crafting_prompt : This method we are generating the prompt that is used in the llm to generate the response
    """
    def __init__(self, ratio, n, genders: List[str]):
        self.ratio = ratio # Gender ratio
        self.n = n # Total number of patients
        self.genders = genders # Prepare the list of genders

    def structured_output_format(self):
        """
            function : Define the response schema and structured output format
        """
        # ResponseSchema for First_Name
        first_name_schema = ResponseSchema(
            name = "First_Name", 
            description = "The first name of the patient."
        )

        # ResponseSchema for Last_Name
        last_name_schema = ResponseSchema(
            name = "Last_Name", 
            description = "The last name of the patient"
        )

        # ResponseSchema for Patient ID
        patient_id_schema = ResponseSchema(
            name = "Patient_ID", 
            description = "A unique 13 character alphanumeric patient identifier"
        )
        
        # ResponseSchema for Gender
        gender_schema = ResponseSchema(
            name = "G_Gender", 
            description = "Indicate the first name you generate belong which Gender: Male or Female"
        )


        # Aggregate all response schemas
        response_schema = [
            first_name_schema, 
            last_name_schema, 
            patient_id_schema,
            gender_schema
        ]

        # === Step 2 : Set Up the Output Parser ====
        # Initialize the StructuredOutputParser with the defined response schemas
        self.output_parser = StructuredOutputParser.from_response_schemas(response_schemas = 
                                                                                response_schema)

        # === Step 3 : Get the format instructions to include in the prompt
        self.format_instructions = self.output_parser.get_format_instructions()

        # Key Components 
        # StructuredOutputParser - Is a langchain tool that forces llm to return data in specific, machine-readable format like JSON
        # ResponseSchema - This class defines an individual field in the output 
        # format_instructions method generates string of instructions that you must include in the prompt. It typically tells the model
        # to wrap its response in a markdown json code block

        return self.output_parser, self.format_instructions


    def crafting_prompt(self):
        
        # This creates necessary files to generate the structured format
        self.structured_output_format()

        # Create a prompt that instructs the LLM to generate only the structured JSON data
        # Define the prompt template using ChatPromptTemplate
        prompt_template = ChatPromptTemplate.from_template(
            """
                you MUST Generate a list of {n} Dutch names along with a unique 13-character alphanumeric Patient ID for each gender provided.
                Always use {genders} to generate a First_Name which belong to the right Gender, two category is possible: 'Male' and 'Female'
                Ensure the names are culturally appropriate for the India.
                Generate unique names, no repetitions, and ensure diversity.
                The ratio of Female to Male is {ratio}:1

                {format_instructions}

                Genders:
                {genders}

                **IMPORTANT** Do not include any explanations, code or additional text.
                You must always generate Indian Names and Patient ID according {format_instructions}
                and NEVER return empty values.
                YOU MUST provide only the JSON array as specified.
                JSON array should have exactly {n} rows and 3 columns
            """
        )

        # Generate the prompt
        # Format the prompt with the number of patients and their genders
        formatted_prompt = prompt_template.format(
            n = self.n, 
            ratio = self.ratio, 
            genders = ', '.join(self.genders), 
            format_instructions = self.format_instructions
        )
        
        # Invoke the model with the query
        response = gemini_model(formatted_prompt)

        # Converting the response into the JSON format
        output_parser = JsonOutputParser()
        json_output = output_parser.invoke(response)
        
        return json_output


if __name__ == "__main__":
        func = GeneratePatientData(ratio = 0.30, n = 10, genders = ['male', 'female'])
        print(func.crafting_prompt())


