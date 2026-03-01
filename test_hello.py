pytest.ini:
[pytest]
addopts = -v
testpaths = .
python_files = test_*.py

test_hello.py:
def test_hello():
    assert 1 + 1 == 2