import os
import re
import pickle
import yaml
import logging
import itertools

from typing import List

# change path to project directory
os.chdir("/Users/kavisanthoshkumar/Documents/GenerativeAIusingAWS/HR_Policy_QueryResolutionWithRAG")

# Load config file
with open('config.yaml', 'rb') as file:
    config = yaml.safe_load(file)


from langchain_core.documents import Document


# Chunking Strategy Function Applied - Extracted Documents
def ChunkingStrategySectionBreaking(docs: List[Document], min_doc_len:int, doc_index:int) -> List[Document]:
    """
        Function : Performing the Chunking Strategy only on the selected Documents
        Arguments :
            min_doc_len : minimum number of character length should be there to be considered for the document
            doc_index : document index form the hr_policy_document
    """

    pattern = r"\n(?=\d+\.\d+)"
    section_docs = [
            section.strip() \
                for section in re.split(pattern, docs[doc_index].page_content)
            ]
    processed_docs = []
    for sg_doc in section_docs:
        if len(sg_doc) > min_doc_len:

            lg_document = Document(
                page_content = sg_doc, 
                metadata = docs[doc_index].metadata
            )

            processed_docs.append(lg_document) 

    return processed_docs


if __name__ == "__main__":

    # Open the HR policy documents that are extracted at the page-wise 
    with open(config["outputs"]["document_output_file_path"], "rb") as f:
        hr_policy_documents = pickle.load(f)

    
    # Perform chunking operation on each and every document from the hr_policy_documents 
    hr_policy_chunked_documents = list(itertools.chain.from_iterable([ChunkingStrategySectionBreaking(
        docs = hr_policy_documents, 
        min_doc_len = config['chunking_arguments']['min_doc_len'],  
        doc_index = index
    ) for index in range(6, 17)]))

    # Appending Top documents where we don't have to perform any custom chunking
    hr_policy_chunked_documents = [hr_policy_documents[4]] + hr_policy_chunked_documents

    print(f"Length of HR policy chunked documents : {len(hr_policy_chunked_documents)}")

    # Save the hr policy chunked documents 
    with open(config['outputs']['chunked_output_file_path'], "wb") as f:
        pickle.dump(hr_policy_chunked_documents, f)

    print("=== SUCCESS : SAVED THE HR POLICY CHUNKED DOCUMENTS ==")

    
    
