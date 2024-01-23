FROM public.ecr.aws/lambda/python:3.11

# Copy requirements.txt
COPY ./requirment.txt .

# Install the specified packages
RUN pip install -r requirment.txt

# Copy function code
COPY test_front.py .

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "test_front.test" ]