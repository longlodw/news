import uuid

def store_content(base_path: str, content: str) -> str:
    uuid_str = str(uuid.uuid4())
    file_path = f"{base_path}/{uuid_str}.txt"
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(content)
    return file_path

def load_content(file_path: str) -> str:
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()
