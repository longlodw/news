from typing import Callable, Generic, Iterable, Iterator, TypeVar

_T = TypeVar('_T')
_V = TypeVar('_V')
class IterMonad(Generic[_T]):
    """
    A generic iterator class that allows for iteration over a collection of type _T.
    """
    def __init__(self, iterable: Iterable[_T]):
        self._iterator = iter(iterable)

    def __iter__(self) -> Iterator[_T]:
        return self._iterator

    def __next__(self) -> _T:
        return next(self._iterator)

    def apply(self, func: Callable[[_T], _V]) -> 'IterMonad[_V]':
        """
        Applies a function to each item in the iterable and returns a new IterMonad with the results.
        """
        return IterMonad(apply(self._iterator, func))

    def filter(self, predicate: Callable[[_T], bool]) -> 'IterMonad[_T]':
        """
        Filters items in the iterable based on a predicate function.
        Returns a new IterMonad with items that satisfy the predicate.
        """
        return IterMonad(filter(self._iterator, predicate))

    def reduce(self, func: Callable[[_T, _T], _T], initial: _T = None) -> _T:
        """
        Reduces the iterable to a single value using a binary function.
        If initial is provided, it is used as the initial accumulator.
        """
        return reduce(self._iterator, func, initial)

def apply(iterable: Iterable[_T], func: Callable[[_T], _V]) -> Iterator[_V]:
    """
    Applies a function to each item in the iterable and returns an iterator of the results.
    """
    for item in iterable:
        yield func(item)

def filter(iterable: Iterable[_T], predicate: Callable[[_T], bool]) -> Iterator[_T]:
    """
    Filters items in the iterable based on a predicate function.
    Returns an iterator of items that satisfy the predicate.
    """
    for item in iterable:
        if predicate(item):
            yield item

def reduce(iterable: Iterable[_T], func: Callable[[_T, _T], _T], initial: _T = None) -> _T:
    """
    Reduces the iterable to a single value using a binary function.
    If initial is provided, it is used as the initial accumulator.
    """
    it = iter(iterable)
    if initial is None:
        initial = next(it)
    accumulator = initial
    for item in it:
        accumulator = func(accumulator, item)
    return accumulator
