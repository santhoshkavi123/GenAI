import os
import pickle
import yaml

os.chdir("/Users/kavisanthoshkumar/Documents/GenerativeAIusingAWS/HR_Policy_QueryResolutionWithRAG")
with open('config.yaml', 'r') as file:
    config = yaml.safe_load(file)

# Import langchain packages
# pyrefly: ignore [missing-import]
from langchain_core.documents import Document
# pyrefly: ignore [missing-import]
from langchain_community.document_loaders import PyMuPDFLoader

def pdf_document_loader(config):
    """
        Function : Read PDF Document Loader
        Arguments:
            config: yaml file
    """
    input_file_path = config['inputs']['document_input_file_path']
    
    # load the PDF document and split them into multiple documents 
    # And save them in pickle format
    loader = PyMuPDFLoader(
        file_path = input_file_path, 
        mode = 'page',
        extract_images = False
    )

    documents = loader.load()
    logger.info(f"Length of Documents : {len(documents)}")

    # Save documents to pickle file
    with open(config['outputs']['document_output_file_path'],"wb") as f:
        pickle.dump(documents, f)

    return None


if __name__ == '__main__':
    # Create logging file
    import logging 
    logging.basicConfig(filename = config['logging']['logging_file_path'], 
                            filemode= 'w')
    logger = logging.getLogger(__name__)

    logger.info("===INFO:CALLING THE PDF DOCUMENT LOADER FUNCTION===")
    pdf_document_loader(config)
    print("=== SUCCESS : RUNNING THE LOGGER FILE ====")
    logger.info("===SUCCESS:LOADED THE PDF DOCUMENT===")
